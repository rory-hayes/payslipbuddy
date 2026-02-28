import { beforeEach, describe, expect, it } from "vitest";
import { canUploadPayslip, canUseHouseholdSharing, canExportAnnual } from "@/lib/services/entitlements";
import { inMemoryDb } from "@/lib/db/in-memory-db";

beforeEach(() => {
  // Reset singleton state for deterministic tests.
  // @ts-expect-error test-only global reset
  global.__PAYSLIP_BUDDY_STATE__ = undefined;
});

describe("entitlements", () => {
  it("allows exactly one free payslip before blocking", () => {
    expect(canUploadPayslip("user_demo").allowed).toBe(true);

    inMemoryDb.incrementUsage("user_demo", "freePayslipsUsed");

    const blocked = canUploadPayslip("user_demo");
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain("1 payslip");
  });

  it("requires Pro for household sharing", () => {
    const blocked = canUseHouseholdSharing("user_demo");
    expect(blocked.allowed).toBe(false);

    inMemoryDb.setSubscriptionStatus("user_demo", "ACTIVE");
    const user = inMemoryDb.getUser("user_demo");
    if (!user) {
      throw new Error("missing demo user");
    }
    user.plan = "PRO";

    expect(canUseHouseholdSharing("user_demo").allowed).toBe(true);
  });

  it("blocks xlsx export on Plus", () => {
    inMemoryDb.setSubscriptionStatus("user_demo", "ACTIVE");
    const user = inMemoryDb.getUser("user_demo");
    if (!user) {
      throw new Error("missing demo user");
    }

    user.plan = "PLUS";
    expect(canExportAnnual("user_demo", "pdf").allowed).toBe(true);
    expect(canExportAnnual("user_demo", "xlsx").allowed).toBe(false);
  });
});
