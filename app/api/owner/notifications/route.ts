import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const auth=await authorizeOwner(request).catch(()=>null);
 if(!auth)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data,error}=await auth.db.from('notification_outbox').select('id,kind,audience,status,created_at,sent_at,attempts,customer_name,service_name,appointment_start').order('created_at',{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:'Unable to load notifications'},{status:503});
 return NextResponse.json({items:data??[]},{headers:{'Cache-Control':'no-store'}});
}
