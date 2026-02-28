export type Region = "UK" | "IE";
export type Currency = "GBP" | "EUR";
export type PlanTier = "FREE" | "PLUS" | "PRO";
export type BillingCycle = "MONTHLY" | "ANNUAL";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export type HouseholdRole = "OWNER" | "MEMBER";
export type HouseholdMemberStatus = "INVITED" | "ACTIVE" | "REMOVED";

export type PayslipStatus = "UPLOADED" | "EXTRACTED" | "CONFIRMED" | "FAILED";
export type PayslipLineItemType = "EARNING" | "DEDUCTION" | "TAX";

export type ExpenseKind = "RECURRING" | "UPCOMING" | "ONE_OFF";

export interface UserProfile {
  id: string;
  email: string;
  region: Region;
  currency: Currency;
  plan: PlanTier;
  billingCycle: BillingCycle | null;
  reminderEnabled: boolean;
  createdAt: string;
}

export interface Household {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
}

export interface HouseholdMember {
  householdId: string;
  userId: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  createdAt: string;
}

export interface Employer {
  id: string;
  userId: string;
  name: string;
  taxRef?: string;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  userId: string;
  bucket: string;
  path: string;
  mimeType: string;
  encrypted: boolean;
  createdAt: string;
}

export interface Payslip {
  id: string;
  userId: string;
  employerId: string;
  periodMonth: number;
  periodYear: number;
  schemaVersion: string;
  sourceFileId: string;
  status: PayslipStatus;
  confidence: number | null;
  notes: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface PayslipBreakdown {
  payslipId: string;
  gross: number;
  net: number;
  tax: number;
  pension: number;
  niOrPrsi: number;
  usc?: number | null;
  bonuses?: number | null;
  overtime?: number | null;
  fieldConfidence: Record<string, number>;
  editedFields: Record<string, boolean>;
  validationErrors: string[];
  createdAt: string;
}

export interface PayslipLineItem {
  id: string;
  payslipId: string;
  type: PayslipLineItemType;
  label: string;
  amount: number;
}

export interface BankImport {
  id: string;
  userId: string;
  fileId: string;
  mappingConfig: Record<string, string>;
  rowCount: number;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  bankImportId: string;
  userId: string;
  postedAt: string;
  description: string;
  amount: number;
  category: string | null;
}

export interface Expense {
  id: string;
  householdId: string;
  category: string;
  kind: ExpenseKind;
  amount: number;
  dueDate?: string | null;
  recurrence?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  householdId: string;
  name: string;
  targetAmount: number;
  targetDate?: string | null;
  progressAmount: number;
  createdAt: string;
}

export interface TaxBackItem {
  id: string;
  region: Region;
  category: string;
  eligibilityRules: string;
  estimateFormula: string;
  officialLink: string;
}

export interface TaxBackEstimate {
  itemId: string;
  category: string;
  estimatedMin: number;
  estimatedMax: number;
  steps: string[];
  officialLink: string;
}

export interface AnnualReportTotals {
  gross: number;
  net: number;
  tax: number;
  pension: number;
  niOrPrsi: number;
  usc: number;
}

export interface MonthlySeriesPoint {
  month: string;
  gross: number;
  net: number;
  tax: number;
  pension: number;
  niOrPrsi: number;
  usc: number;
}

export interface AnnualReport {
  userId: string;
  year: number;
  totals: AnnualReportTotals;
  monthlySeries: MonthlySeriesPoint[];
  employerTimeline: Array<{
    employerId: string;
    employerName: string;
    months: string[];
  }>;
  lineItemTotals: Array<{
    type: PayslipLineItemType;
    label: string;
    total: number;
    occurrences: number;
    irregular: boolean;
    isNewThisYear: boolean;
  }>;
  dataQuality: {
    averageConfidence: number;
    missingMonths: number[];
    userEditedFieldCount: number;
  };
  taxBackSummary: TaxBackEstimate[];
  exportPdfUrl: string | null;
  exportXlsxUrl: string | null;
}

export interface UsageEntitlement {
  userId: string;
  freePayslipsUsed: number;
  freeCsvUsed: number;
  subscriptionStatus: SubscriptionStatus;
}

export interface ParsedPayslip {
  schemaVersion: string;
  periodMonth: number;
  periodYear: number;
  employerName: string;
  gross: number;
  net: number;
  tax: number;
  pension: number;
  niOrPrsi: number;
  usc?: number | null;
  bonuses?: number | null;
  overtime?: number | null;
  lineItems: Array<{
    type: PayslipLineItemType;
    label: string;
    amount: number;
    confidence?: number;
    editedByUser?: boolean;
  }>;
  fieldConfidence: Record<string, number>;
  validationErrors: string[];
  editedFields: Record<string, boolean>;
}

export interface MomDiff {
  metric: "gross" | "net" | "tax" | "pension" | "niOrPrsi" | "usc" | "bonuses" | "overtime";
  current: number;
  previous: number;
  delta: number;
  direction: "UP" | "DOWN" | "UNCHANGED";
  insight: string;
}
