-- Styles by Dujuan D / B4.2.5 -- LOCAL SUPABASE ONLY.
-- Apply ONLY at http://127.0.0.1:54423. Never apply to hosted/linked database.
-- This migration is intentionally NOT in supabase/migrations.
-- Does not refund, move money, confirm appointments, or alter webhook behavior.
BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_reconciliation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key uuid NOT NULL UNIQUE,
  reconciliation_id uuid NOT NULL REFERENCES public.payment_reconciliation(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  actor_email text NOT NULL,
  action text NOT NULL CHECK (action IN ('note_added','resolved')),
  resolution_kind text CHECK (resolution_kind IS NULL OR resolution_kind IN ('refund_documented','credit_documented','manual_resolved')),
  external_reference text,
  note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 20 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_reconciliation_actions_lookup_idx
  ON public.payment_reconciliation_actions(reconciliation_id, created_at DESC);
ALTER TABLE public.payment_reconciliation_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_reconciliation_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.payment_reconciliation_actions TO service_role;

-- Defense in depth: the audit trail is append-only (including for service_role).
CREATE OR REPLACE FUNCTION public.guard_reconciliation_action_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $body$
BEGIN
  RAISE EXCEPTION 'Payment reconciliation audit entries cannot be changed or deleted';
END;
$body$;
DROP TRIGGER IF EXISTS payment_reconciliation_actions_immutable ON public.payment_reconciliation_actions;
CREATE TRIGGER payment_reconciliation_actions_immutable
BEFORE UPDATE OR DELETE ON public.payment_reconciliation_actions
FOR EACH ROW EXECUTE FUNCTION public.guard_reconciliation_action_immutability();
REVOKE ALL ON FUNCTION public.guard_reconciliation_action_immutability() FROM PUBLIC, anon, authenticated;

-- Transactionally append the action and (only for explicit resolution) close the review.
-- The HTTP route checks the authenticated owner first; service_role is the ONLY RPC caller.
CREATE OR REPLACE FUNCTION public.record_owner_reconciliation_action(
  p_action_key uuid,
  p_reconciliation_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_action text,
  p_note text,
  p_resolution_kind text DEFAULT NULL,
  p_external_reference text DEFAULT NULL,
  p_acknowledged boolean DEFAULT FALSE
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $body$
DECLARE
  v_review public.payment_reconciliation%ROWTYPE;
  v_previous uuid;
  v_ref text := nullif(btrim(coalesce(p_external_reference,'')), '');
BEGIN
  IF p_action_key IS NULL OR p_reconciliation_id IS NULL OR p_actor_user_id IS NULL
     OR p_actor_email IS NULL OR char_length(btrim(p_actor_email)) NOT BETWEEN 3 AND 254
     OR p_action NOT IN ('note_added','resolved')
     OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 20 AND 1200 THEN
    RAISE EXCEPTION 'Invalid reconciliation action';
  END IF;
  SELECT reconciliation_id INTO v_previous
  FROM public.payment_reconciliation_actions WHERE action_key = p_action_key;
  IF FOUND THEN
    IF v_previous <> p_reconciliation_id THEN RAISE EXCEPTION 'Action key conflict'; END IF;
    RETURN FALSE; -- Idempotent request: already recorded.
  END IF;

  SELECT * INTO v_review FROM public.payment_reconciliation
  WHERE id = p_reconciliation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review item not found'; END IF;
  -- A parallel retry may have committed while this transaction waited for the lock.
  SELECT reconciliation_id INTO v_previous
  FROM public.payment_reconciliation_actions WHERE action_key = p_action_key;
  IF FOUND THEN
    IF v_previous <> p_reconciliation_id THEN RAISE EXCEPTION 'Action key conflict'; END IF;
    RETURN FALSE;
  END IF;

  IF p_action = 'resolved' THEN
    IF v_review.status <> 'needs_review' OR p_acknowledged IS DISTINCT FROM TRUE
       OR p_resolution_kind IS NULL
       OR p_resolution_kind NOT IN ('refund_documented','credit_documented','manual_resolved') THEN
      RAISE EXCEPTION 'Resolution not permitted';
    END IF;
    -- References are owner-supplied documentary evidence, NOT verified by this system.
    IF p_resolution_kind = 'refund_documented' AND
       (v_ref IS NULL OR v_ref !~ '^re_[A-Za-z0-9]{6,}$') THEN
      RAISE EXCEPTION 'Provide the external Stripe refund ID';
    END IF;
    IF p_resolution_kind = 'credit_documented' AND
       (v_ref IS NULL OR char_length(v_ref) < 6 OR char_length(v_ref) > 120) THEN
      RAISE EXCEPTION 'Provide the external credit reference';
    END IF;
    UPDATE public.payment_reconciliation SET
      status = 'resolved',
      resolution_note = left(p_resolution_kind || ': ' || btrim(p_note) ||
        CASE WHEN v_ref IS NULL THEN '' ELSE ' [Reference: ' || v_ref || ']' END, 1500),
      resolved_at = now()
    WHERE id = p_reconciliation_id AND status = 'needs_review';
  ELSE
    IF p_resolution_kind IS NOT NULL OR v_ref IS NOT NULL THEN
      RAISE EXCEPTION 'Notes cannot declare a resolution';
    END IF;
  END IF;

  INSERT INTO public.payment_reconciliation_actions(
    action_key,reconciliation_id,actor_user_id,actor_email,action,resolution_kind,external_reference,note
  ) VALUES(
    p_action_key,p_reconciliation_id,p_actor_user_id,lower(btrim(p_actor_email)),p_action,
    CASE WHEN p_action = 'resolved' THEN p_resolution_kind ELSE NULL END,v_ref,btrim(p_note)
  ) ON CONFLICT (action_key) DO NOTHING;
  RETURN TRUE;
END;
$body$;
REVOKE ALL ON FUNCTION public.record_owner_reconciliation_action(
  uuid,uuid,uuid,text,text,text,text,text,boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_owner_reconciliation_action(
  uuid,uuid,uuid,text,text,text,text,text,boolean
) TO service_role;
COMMIT;

-- Read-only installation verification. Expected: present=true; anon=false; authenticated=false; service_role=true.
SELECT
  to_regprocedure('public.record_owner_reconciliation_action(uuid,uuid,uuid,text,text,text,text,text,boolean)') IS NOT NULL AS present,
  has_function_privilege('anon','public.record_owner_reconciliation_action(uuid,uuid,uuid,text,text,text,text,text,boolean)','EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated','public.record_owner_reconciliation_action(uuid,uuid,uuid,text,text,text,text,text,boolean)','EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role','public.record_owner_reconciliation_action(uuid,uuid,uuid,text,text,text,text,text,boolean)','EXECUTE') AS service_role_can_execute;
