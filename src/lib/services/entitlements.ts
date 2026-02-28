import { inMemoryDb } from "@/lib/db/in-memory-db";
import type { PlanTier, UserProfile } from "@/lib/types/domain";

export const FREE_LIMITS = {
  payslips: 1,
  bankCsv: 0
} as const;

export interface PlanCapabilities {
  unlimitedPayslips: boolean;
  annualDashboard: boolean;
  pdfExport: boolean;
  xlsxExport: boolean;
  householdSharing: boolean;
  multiEmployer: boolean;
  monthsHistory: number;
}

const capabilities: Record<PlanTier, PlanCapabilities> = {
  FREE: {
    unlimitedPayslips: false,
    annualDashboard: false,
    pdfExport: false,
    xlsxExport: false,
    householdSharing: false,
    multiEmployer: false,
    monthsHistory: 1
  },
  PLUS: {
    unlimitedPayslips: true,
    annualDashboard: true,
    pdfExport: true,
    xlsxExport: false,
    householdSharing: false,
    multiEmployer: false,
    monthsHistory: 12
  },
  PRO: {
    unlimitedPayslips: true,
    annualDashboard: true,
    pdfExport: true,
    xlsxExport: true,
    householdSharing: true,
    multiEmployer: true,
    monthsHistory: 36
  }
};

export function getCapabilities(user: UserProfile | null): PlanCapabilities {
  if (!user) {
    return capabilities.FREE;
  }

  return capabilities[user.plan];
}

function resolveEntitlementContext(userId: string): { user: UserProfile; subscriptionStatus: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" } | null {
  const user = inMemoryDb.getUser(userId);
  const usage = inMemoryDb.getUsage(userId);
  if (!user || !usage) {
    return null;
  }

  if (usage.subscriptionStatus === "ACTIVE" && user.plan !== "FREE") {
    return { user, subscriptionStatus: usage.subscriptionStatus };
  }

  const households = inMemoryDb.listHouseholdsByUser(userId);
  for (const household of households) {
    if (household.ownerUserId === userId) {
      continue;
    }

    const owner = inMemoryDb.getUser(household.ownerUserId);
    const ownerUsage = inMemoryDb.getUsage(household.ownerUserId);
    if (!owner || !ownerUsage) {
      continue;
    }

    if (ownerUsage.subscriptionStatus === "ACTIVE" && owner.plan === "PRO") {
      return { user: owner, subscriptionStatus: ownerUsage.subscriptionStatus };
    }
  }

  return { user, subscriptionStatus: usage.subscriptionStatus };
}

export function hasActiveSubscription(userId: string): boolean {
  const usage = inMemoryDb.getUsage(userId);
  return usage?.subscriptionStatus === "ACTIVE";
}

export function canUploadPayslip(userId: string): { allowed: boolean; reason?: string } {
  const usage = inMemoryDb.getUsage(userId);
  const user = inMemoryDb.getUser(userId);
  if (!usage || !user) {
    return { allowed: false, reason: "Usage entitlement not found." };
  }

  const planCapabilities = getCapabilities(user);

  if (planCapabilities.unlimitedPayslips && usage.subscriptionStatus === "ACTIVE") {
    return { allowed: true };
  }

  if (usage.freePayslipsUsed >= FREE_LIMITS.payslips) {
    return { allowed: false, reason: "Free plan limit reached (1 payslip). Upgrade to continue." };
  }

  return { allowed: true };
}

export function canImportBankCsv(userId: string): { allowed: boolean; reason?: string } {
  const usage = inMemoryDb.getUsage(userId);
  if (!usage) {
    return { allowed: false, reason: "Usage entitlement not found." };
  }

  if (usage.subscriptionStatus === "ACTIVE") {
    return { allowed: false, reason: "Bank CSV import is deferred to V1.5." };
  }

  if (usage.freeCsvUsed >= FREE_LIMITS.bankCsv) {
    return { allowed: false, reason: "Bank CSV import is deferred to V1.5." };
  }

  return { allowed: false, reason: "Bank CSV import is deferred to V1.5." };
}

export function canUseHouseholdSharing(userId: string): { allowed: boolean; reason?: string } {
  const user = inMemoryDb.getUser(userId);
  const usage = inMemoryDb.getUsage(userId);
  if (!user || !usage) {
    return { allowed: false, reason: "User entitlement unavailable." };
  }

  const planCapabilities = getCapabilities(user);
  if (!planCapabilities.householdSharing || usage.subscriptionStatus !== "ACTIVE") {
    return { allowed: false, reason: "Household sharing is available on Pro only." };
  }

  return { allowed: true };
}

export function canExportAnnual(userId: string, format: "pdf" | "xlsx"): { allowed: boolean; reason?: string } {
  const context = resolveEntitlementContext(userId);
  if (!context) {
    return { allowed: false, reason: "User entitlement unavailable." };
  }

  const planCapabilities = getCapabilities(context.user);
  if (context.subscriptionStatus !== "ACTIVE") {
    return { allowed: false, reason: "Annual exports require a paid plan." };
  }

  if (format === "pdf" && !planCapabilities.pdfExport) {
    return { allowed: false, reason: "PDF export is unavailable for this plan." };
  }

  if (format === "xlsx" && !planCapabilities.xlsxExport) {
    return { allowed: false, reason: "XLSX export is available on Pro only." };
  }

  return { allowed: true };
}

export function canViewAnnualDashboard(userId: string): { allowed: boolean; reason?: string } {
  const context = resolveEntitlementContext(userId);
  if (!context) {
    return { allowed: false, reason: "User entitlement unavailable." };
  }

  const planCapabilities = getCapabilities(context.user);
  if (context.subscriptionStatus !== "ACTIVE" || !planCapabilities.annualDashboard) {
    return { allowed: false, reason: "Annual dashboard is available on paid plans." };
  }

  return { allowed: true };
}

export function canUseEmployer(userId: string, employerId: string): { allowed: boolean; reason?: string } {
  const user = inMemoryDb.getUser(userId);
  const usage = inMemoryDb.getUsage(userId);
  if (!user || !usage) {
    return { allowed: false, reason: "User entitlement unavailable." };
  }

  const planCapabilities = getCapabilities(user);
  if (planCapabilities.multiEmployer && usage.subscriptionStatus === "ACTIVE") {
    return { allowed: true };
  }

  const existingEmployers = new Set(inMemoryDb.listPayslipsByUser(userId).map((item) => item.employerId));
  if (existingEmployers.size === 0 || existingEmployers.has(employerId)) {
    return { allowed: true };
  }

  return { allowed: false, reason: "Multi-employer support is available on Pro." };
}

export function consumePayslipUpload(userId: string): void {
  const user = inMemoryDb.getUser(userId);
  if (!user) {
    return;
  }

  if (!getCapabilities(user).unlimitedPayslips || !hasActiveSubscription(userId)) {
    inMemoryDb.incrementUsage(userId, "freePayslipsUsed");
  }
}

export function consumeCsvImport(userId: string): void {
  if (!hasActiveSubscription(userId)) {
    inMemoryDb.incrementUsage(userId, "freeCsvUsed");
  }
}

export function usageMeter(userId: string) {
  const usage = inMemoryDb.getUsage(userId);
  const user = inMemoryDb.getUser(userId);
  if (!usage || !user) {
    return null;
  }

  const planCapabilities = getCapabilities(user);
  const hasUnlimitedPayslips = planCapabilities.unlimitedPayslips && usage.subscriptionStatus === "ACTIVE";

  return {
    plan: user.plan,
    billingCycle: user.billingCycle,
    subscriptionStatus: usage.subscriptionStatus,
    freePayslipsUsed: usage.freePayslipsUsed,
    freePayslipsLimit: FREE_LIMITS.payslips,
    freeCsvUsed: usage.freeCsvUsed,
    freeCsvLimit: FREE_LIMITS.bankCsv,
    unlimitedPayslips: hasUnlimitedPayslips,
    annualDashboard: planCapabilities.annualDashboard && usage.subscriptionStatus === "ACTIVE",
    pdfExport: planCapabilities.pdfExport && usage.subscriptionStatus === "ACTIVE",
    xlsxExport: planCapabilities.xlsxExport && usage.subscriptionStatus === "ACTIVE",
    householdSharing: planCapabilities.householdSharing && usage.subscriptionStatus === "ACTIVE",
    multiEmployer: planCapabilities.multiEmployer && usage.subscriptionStatus === "ACTIVE"
  };
}
