import { describe, expect, it } from "vitest";
import { business, canBookService, remainingBalanceCents, services } from "../lib/business";
describe("B2 business rules", () => {
 it("uses the approved brand and a $10 fee and 24-hour policy", () => { expect(business.brand).toBe("STYLES BY DUJUAN D"); expect(business.bookingDepositCents).toBe(1000); expect(business.rescheduleNoticeHours).toBe(24); });
 it("does not allow booking before pricing and duration are configured", () => { expect(services).toHaveLength(8); expect(services.every(s => !canBookService(s))).toBe(true); expect(business.bookingsEnabled).toBe(false); });
 it("credits the fee instead of adding it to service cost", () => { expect(remainingBalanceCents(5500)).toBe(4500); });
 it("rejects invalid amounts", () => { expect(() => remainingBalanceCents(500)).toThrow(); expect(() => remainingBalanceCents(5500.5)).toThrow(); });
});
