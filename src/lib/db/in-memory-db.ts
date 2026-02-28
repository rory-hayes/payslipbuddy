import fs from "node:fs";
import path from "node:path";
import type {
  AnnualReport,
  BankImport,
  BankTransaction,
  Employer,
  Expense,
  FileRecord,
  Goal,
  Household,
  HouseholdMember,
  ParsedPayslip,
  Payslip,
  PayslipBreakdown,
  PayslipLineItem,
  TaxBackItem,
  UsageEntitlement,
  UserProfile
} from "@/lib/types/domain";

interface ExtractionDraft {
  payslipId: string;
  payload: ParsedPayslip;
  confidence: number;
  notes: string | null;
  createdAt: string;
}

interface InMemoryState {
  users: UserProfile[];
  households: Household[];
  householdMembers: HouseholdMember[];
  employers: Employer[];
  files: FileRecord[];
  payslips: Payslip[];
  payslipBreakdowns: PayslipBreakdown[];
  payslipLineItems: PayslipLineItem[];
  bankImports: BankImport[];
  bankTransactions: BankTransaction[];
  expenses: Expense[];
  goals: Goal[];
  taxBackItems: TaxBackItem[];
  annualReports: AnnualReport[];
  usage: UsageEntitlement[];
  extractionDrafts: ExtractionDraft[];
  auditLogs: Array<{
    id: string;
    userId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

const persistStateEnabled =
  process.env.NODE_ENV !== "test" &&
  process.env.VERCEL !== "1" &&
  process.env.PAYSLIP_BUDDY_PERSIST_STATE !== "false";

const stateFilePath =
  process.env.PAYSLIP_BUDDY_STATE_FILE ??
  path.join(process.cwd(), ".data", "payslip-buddy-state.json");

const initialUser: UserProfile = {
  id: "user_demo",
  email: "demo@payslipbuddy.app",
  region: "UK",
  currency: "GBP",
  plan: "FREE",
  billingCycle: null,
  reminderEnabled: true,
  onboardingCompleted: false,
  onboardingCompletedAt: null,
  budgetSetupCompleted: false,
  budgetSetupCompletedAt: null,
  monthlyIncomeTarget: null,
  createdAt: new Date().toISOString()
};

const initialHousehold: Household = {
  id: "house_demo",
  ownerUserId: initialUser.id,
  name: "My Household",
  createdAt: new Date().toISOString()
};

const initialState: InMemoryState = {
  users: [initialUser],
  households: [initialHousehold],
  householdMembers: [
    {
      householdId: initialHousehold.id,
      userId: initialUser.id,
      role: "OWNER",
      status: "ACTIVE",
      createdAt: new Date().toISOString()
    }
  ],
  employers: [
    {
      id: "emp_demo",
      userId: initialUser.id,
      name: "Example Ltd",
      createdAt: new Date().toISOString()
    }
  ],
  files: [],
  payslips: [],
  payslipBreakdowns: [],
  payslipLineItems: [],
  bankImports: [],
  bankTransactions: [],
  expenses: [],
  goals: [],
  taxBackItems: [
    {
      id: "tax_uk_1",
      region: "UK",
      category: "Work Uniform Maintenance",
      eligibilityRules: "You wash or repair your own required uniform.",
      estimateFormula: "Flat-rate estimate up to 60 GBP depending on role",
      officialLink: "https://www.gov.uk/tax-relief-for-employees"
    },
    {
      id: "tax_ie_1",
      region: "IE",
      category: "Remote Working Relief",
      eligibilityRules: "You worked from home and paid eligible utility costs.",
      estimateFormula: "Share of utility costs at marginal rate",
      officialLink: "https://www.revenue.ie/en/jobs-and-pensions/eworking/index.aspx"
    }
  ],
  annualReports: [],
  usage: [
    {
      userId: initialUser.id,
      freePayslipsUsed: 0,
      freeCsvUsed: 0,
      subscriptionStatus: "TRIAL"
    }
  ],
  extractionDrafts: [],
  auditLogs: []
};

declare global {
  // eslint-disable-next-line no-var
  var __PAYSLIP_BUDDY_STATE__: InMemoryState | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function loadPersistedState(): InMemoryState | null {
  if (!persistStateEnabled) {
    return null;
  }

  try {
    const raw = fs.readFileSync(stateFilePath, "utf8");
    const parsed = JSON.parse(raw) as InMemoryState;

    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.payslips)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function persistState(): void {
  if (!persistStateEnabled || !globalThis.__PAYSLIP_BUDDY_STATE__) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
    fs.writeFileSync(stateFilePath, JSON.stringify(globalThis.__PAYSLIP_BUDDY_STATE__), "utf8");
  } catch (error) {
    console.warn("State persistence skipped:", error);
  }
}

export function getState(): InMemoryState {
  if (!globalThis.__PAYSLIP_BUDDY_STATE__) {
    globalThis.__PAYSLIP_BUDDY_STATE__ = loadPersistedState() ?? structuredClone(initialState);
  }

  return globalThis.__PAYSLIP_BUDDY_STATE__;
}

export const inMemoryDb = {
  getUser(userId: string) {
    return getState().users.find((user) => user.id === userId) ?? null;
  },

  ensureUser(input: { id: string; email?: string | null }) {
    const existing = this.getUser(input.id);

    if (existing) {
      if (input.email && existing.email !== input.email) {
        existing.email = input.email;
      }

      if (typeof existing.onboardingCompleted !== "boolean") {
        existing.onboardingCompleted = false;
      }

      if (typeof existing.onboardingCompletedAt === "undefined") {
        existing.onboardingCompletedAt = null;
      }

      if (typeof existing.budgetSetupCompleted !== "boolean") {
        existing.budgetSetupCompleted = false;
      }

      if (typeof existing.budgetSetupCompletedAt === "undefined") {
        existing.budgetSetupCompletedAt = null;
      }

      if (typeof existing.monthlyIncomeTarget === "undefined") {
        existing.monthlyIncomeTarget = null;
      }

      if (this.listHouseholdsByUser(existing.id).length === 0) {
        const household: Household = {
          id: id("house"),
          ownerUserId: existing.id,
          name: "My Household",
          createdAt: nowIso()
        };
        getState().households.push(household);
        getState().householdMembers.push({
          householdId: household.id,
          userId: existing.id,
          role: "OWNER",
          status: "ACTIVE",
          createdAt: nowIso()
        });
      }

      if (!this.getUsage(existing.id)) {
        getState().usage.push({
          userId: existing.id,
          freePayslipsUsed: 0,
          freeCsvUsed: 0,
          subscriptionStatus: "TRIAL"
        });
      }

      if (this.listEmployersByUser(existing.id).length === 0) {
        getState().employers.push({
          id: id("emp"),
          userId: existing.id,
          name: "Primary Employer",
          createdAt: nowIso()
        });
      }

      persistState();
      return existing;
    }

    const user: UserProfile = {
      id: input.id,
      email: input.email ?? `${input.id}@payslipbuddy.local`,
      region: "UK",
      currency: "GBP",
      plan: "FREE",
      billingCycle: null,
      reminderEnabled: true,
      onboardingCompleted: false,
      onboardingCompletedAt: null,
      budgetSetupCompleted: false,
      budgetSetupCompletedAt: null,
      monthlyIncomeTarget: null,
      createdAt: nowIso()
    };

    const household: Household = {
      id: id("house"),
      ownerUserId: user.id,
      name: "My Household",
      createdAt: nowIso()
    };

    const employer: Employer = {
      id: id("emp"),
      userId: user.id,
      name: "Primary Employer",
      createdAt: nowIso()
    };

    getState().users.push(user);
    getState().households.push(household);
    getState().householdMembers.push({
      householdId: household.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
      createdAt: nowIso()
    });
    getState().employers.push(employer);
    getState().usage.push({
      userId: user.id,
      freePayslipsUsed: 0,
      freeCsvUsed: 0,
      subscriptionStatus: "TRIAL"
    });

    persistState();
    return user;
  },

  listUsers() {
    return getState().users;
  },

  getEmployer(employerId: string) {
    return getState().employers.find((employer) => employer.id === employerId) ?? null;
  },

  listEmployersByUser(userId: string) {
    return getState().employers.filter((employer) => employer.userId === userId);
  },

  addEmployer(input: Omit<Employer, "id" | "createdAt">) {
    const employer: Employer = {
      ...input,
      id: id("emp"),
      createdAt: nowIso()
    };
    getState().employers.push(employer);
    persistState();
    return employer;
  },

  updateUserRegion(userId: string, region: "UK" | "IE") {
    const user = this.getUser(userId);
    if (!user) {
      return null;
    }

    user.region = region;
    user.currency = region === "UK" ? "GBP" : "EUR";
    persistState();
    return user;
  },

  setReminderEnabled(userId: string, enabled: boolean) {
    const user = this.getUser(userId);
    if (!user) {
      return null;
    }

    user.reminderEnabled = enabled;
    persistState();
    return user;
  },

  setOnboardingCompleted(userId: string, completed: boolean) {
    const user = this.getUser(userId);
    if (!user) {
      return null;
    }

    user.onboardingCompleted = completed;
    user.onboardingCompletedAt = completed ? nowIso() : null;
    persistState();
    return user;
  },

  setBudgetSetupCompleted(userId: string, completed: boolean) {
    const user = this.getUser(userId);
    if (!user) {
      return null;
    }

    user.budgetSetupCompleted = completed;
    user.budgetSetupCompletedAt = completed ? nowIso() : null;
    persistState();
    return user;
  },

  setMonthlyIncomeTarget(userId: string, target: number | null) {
    const user = this.getUser(userId);
    if (!user) {
      return null;
    }

    user.monthlyIncomeTarget = target;
    persistState();
    return user;
  },

  setUserPlanAndCycle(userId: string, plan: "FREE" | "PLUS" | "PRO", billingCycle: "MONTHLY" | "ANNUAL" | null) {
    const user = this.getUser(userId);
    if (!user) {
      return null;
    }

    user.plan = plan;
    user.billingCycle = billingCycle;
    persistState();
    return user;
  },

  addFile(input: Omit<FileRecord, "id" | "createdAt" | "encrypted"> & { encrypted?: boolean }) {
    const record: FileRecord = {
      id: id("file"),
      createdAt: nowIso(),
      encrypted: input.encrypted ?? true,
      userId: input.userId,
      bucket: input.bucket,
      path: input.path,
      mimeType: input.mimeType
    };

    getState().files.push(record);
    persistState();
    return record;
  },

  getFile(fileId: string) {
    return getState().files.find((file) => file.id === fileId) ?? null;
  },

  listFilesByUser(userId: string) {
    return getState().files.filter((file) => file.userId === userId);
  },

  deleteFile(fileId: string) {
    const state = getState();
    const index = state.files.findIndex((file) => file.id === fileId);
    if (index < 0) {
      return false;
    }
    state.files.splice(index, 1);
    persistState();
    return true;
  },

  addPayslip(input: {
    userId: string;
    employerId: string;
    sourceFileId: string;
    periodMonth: number;
    periodYear: number;
    schemaVersion?: string;
  }) {
    const payslip: Payslip = {
      id: id("pay"),
      userId: input.userId,
      employerId: input.employerId,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      schemaVersion: input.schemaVersion ?? "UK_v1",
      sourceFileId: input.sourceFileId,
      status: "UPLOADED",
      confidence: null,
      notes: null,
      createdAt: nowIso(),
      confirmedAt: null
    };

    getState().payslips.push(payslip);
    persistState();
    return payslip;
  },

  getPayslip(payslipId: string) {
    return getState().payslips.find((item) => item.id === payslipId) ?? null;
  },

  listPayslipsByUser(userId: string) {
    return getState()
      .payslips.filter((payslip) => payslip.userId === userId)
      .sort((a, b) => {
        const aStamp = `${a.periodYear}${String(a.periodMonth).padStart(2, "0")}`;
        const bStamp = `${b.periodYear}${String(b.periodMonth).padStart(2, "0")}`;
        return bStamp.localeCompare(aStamp);
      });
  },

  setPayslipExtracted(payslipId: string, confidence: number, notes: string | null) {
    const payslip = this.getPayslip(payslipId);
    if (!payslip) {
      return null;
    }

    payslip.status = "EXTRACTED";
    payslip.confidence = confidence;
    payslip.notes = notes;
    persistState();
    return payslip;
  },

  setPayslipConfirmed(payslipId: string) {
    const payslip = this.getPayslip(payslipId);
    if (!payslip) {
      return null;
    }

    payslip.status = "CONFIRMED";
    payslip.confirmedAt = nowIso();
    persistState();
    return payslip;
  },

  saveBreakdown(payslipId: string, parsed: ParsedPayslip) {
    const existingBreakdownIndex = getState().payslipBreakdowns.findIndex((entry) => entry.payslipId === payslipId);
    const breakdown: PayslipBreakdown = {
      payslipId,
      gross: parsed.gross,
      net: parsed.net,
      tax: parsed.tax,
      pension: parsed.pension,
      niOrPrsi: parsed.niOrPrsi,
      usc: parsed.usc ?? null,
      bonuses: parsed.bonuses ?? null,
      overtime: parsed.overtime ?? null,
      fieldConfidence: parsed.fieldConfidence,
      editedFields: parsed.editedFields,
      validationErrors: parsed.validationErrors,
      createdAt: nowIso()
    };

    if (existingBreakdownIndex >= 0) {
      getState().payslipBreakdowns[existingBreakdownIndex] = breakdown;
    } else {
      getState().payslipBreakdowns.push(breakdown);
    }

    getState().payslipLineItems = getState().payslipLineItems.filter((entry) => entry.payslipId !== payslipId);

    const lineItems: PayslipLineItem[] = parsed.lineItems.map((item) => ({
      id: id("line"),
      payslipId,
      type: item.type,
      label: item.label,
      amount: item.amount
    }));
    getState().payslipLineItems.push(...lineItems);

    persistState();
    return breakdown;
  },

  listLineItemsByPayslip(payslipId: string) {
    return getState().payslipLineItems.filter((item) => item.payslipId === payslipId);
  },

  getBreakdown(payslipId: string) {
    return getState().payslipBreakdowns.find((entry) => entry.payslipId === payslipId) ?? null;
  },

  saveExtractionDraft(input: Omit<ExtractionDraft, "createdAt">) {
    const state = getState();
    const index = state.extractionDrafts.findIndex((draft) => draft.payslipId === input.payslipId);
    const draft: ExtractionDraft = { ...input, createdAt: nowIso() };

    if (index >= 0) {
      state.extractionDrafts[index] = draft;
    } else {
      state.extractionDrafts.push(draft);
    }

    persistState();
    return draft;
  },

  getExtractionDraft(payslipId: string) {
    return getState().extractionDrafts.find((draft) => draft.payslipId === payslipId) ?? null;
  },

  listConfirmedBreakdowns(userId: string) {
    const confirmedIds = new Set(
      getState()
        .payslips.filter((payslip) => payslip.userId === userId && payslip.status === "CONFIRMED")
        .map((payslip) => payslip.id)
    );

    return getState().payslipBreakdowns.filter((breakdown) => confirmedIds.has(breakdown.payslipId));
  },

  getUsage(userId: string) {
    return getState().usage.find((entry) => entry.userId === userId) ?? null;
  },

  incrementUsage(userId: string, field: "freePayslipsUsed" | "freeCsvUsed") {
    const usage = this.getUsage(userId);
    if (!usage) {
      return null;
    }

    usage[field] += 1;
    persistState();
    return usage;
  },

  setSubscriptionStatus(userId: string, status: UsageEntitlement["subscriptionStatus"]) {
    const usage = this.getUsage(userId);
    if (!usage) {
      return null;
    }

    usage.subscriptionStatus = status;
    const user = this.getUser(userId);
    if (user) {
      if (status === "ACTIVE") {
        user.plan = user.plan === "PLUS" || user.plan === "PRO" ? user.plan : "PLUS";
        user.billingCycle = user.billingCycle ?? "MONTHLY";
      } else if (status === "CANCELED") {
        user.plan = "FREE";
        user.billingCycle = null;
      }
    }

    persistState();
    return usage;
  },

  listTaxBackByRegion(region: "UK" | "IE") {
    return getState().taxBackItems.filter((item) => item.region === region);
  },

  addBankImport(input: Omit<BankImport, "id" | "createdAt">) {
    const record: BankImport = {
      ...input,
      id: id("bank"),
      createdAt: nowIso()
    };

    getState().bankImports.push(record);
    persistState();
    return record;
  },

  addBankTransactions(transactions: Omit<BankTransaction, "id">[]) {
    const rows = transactions.map((transaction) => ({ ...transaction, id: id("txn") }));
    getState().bankTransactions.push(...rows);
    persistState();
    return rows;
  },

  listTransactionsByUser(userId: string) {
    return getState().bankTransactions.filter((transaction) => transaction.userId === userId);
  },

  addExpense(input: Omit<Expense, "id" | "createdAt">) {
    const expense: Expense = {
      ...input,
      id: id("exp"),
      createdAt: nowIso()
    };

    getState().expenses.push(expense);
    persistState();
    return expense;
  },

  getExpense(expenseId: string) {
    return getState().expenses.find((expense) => expense.id === expenseId) ?? null;
  },

  listExpensesByHousehold(householdId: string) {
    return getState().expenses.filter((expense) => expense.householdId === householdId);
  },

  updateExpense(
    expenseId: string,
    input: Partial<Pick<Expense, "category" | "kind" | "amount" | "dueDate" | "recurrence" | "notes">>
  ) {
    const expense = this.getExpense(expenseId);
    if (!expense) {
      return null;
    }

    if (typeof input.category === "string") {
      expense.category = input.category;
    }
    if (typeof input.kind === "string") {
      expense.kind = input.kind;
    }
    if (typeof input.amount === "number") {
      expense.amount = input.amount;
    }
    if (typeof input.dueDate !== "undefined") {
      expense.dueDate = input.dueDate;
    }
    if (typeof input.recurrence !== "undefined") {
      expense.recurrence = input.recurrence;
    }
    if (typeof input.notes !== "undefined") {
      expense.notes = input.notes;
    }

    persistState();
    return expense;
  },

  deleteExpense(expenseId: string) {
    const state = getState();
    const index = state.expenses.findIndex((expense) => expense.id === expenseId);
    if (index < 0) {
      return false;
    }
    state.expenses.splice(index, 1);
    persistState();
    return true;
  },

  addGoal(input: Omit<Goal, "id" | "createdAt">) {
    const goal: Goal = {
      ...input,
      id: id("goal"),
      createdAt: nowIso()
    };

    getState().goals.push(goal);
    persistState();
    return goal;
  },

  getGoal(goalId: string) {
    return getState().goals.find((goal) => goal.id === goalId) ?? null;
  },

  listGoalsByHousehold(householdId: string) {
    return getState().goals.filter((goal) => goal.householdId === householdId);
  },

  updateGoal(goalId: string, input: Partial<Pick<Goal, "name" | "targetAmount" | "targetDate" | "progressAmount">>) {
    const goal = this.getGoal(goalId);
    if (!goal) {
      return null;
    }

    if (typeof input.name === "string") {
      goal.name = input.name;
    }
    if (typeof input.targetAmount === "number") {
      goal.targetAmount = input.targetAmount;
    }
    if (typeof input.targetDate !== "undefined") {
      goal.targetDate = input.targetDate;
    }
    if (typeof input.progressAmount === "number") {
      goal.progressAmount = input.progressAmount;
    }

    persistState();
    return goal;
  },

  deleteGoal(goalId: string) {
    const state = getState();
    const index = state.goals.findIndex((goal) => goal.id === goalId);
    if (index < 0) {
      return false;
    }
    state.goals.splice(index, 1);
    persistState();
    return true;
  },

  getHousehold(householdId: string) {
    return getState().households.find((household) => household.id === householdId) ?? null;
  },

  updateHouseholdName(householdId: string, name: string) {
    const household = this.getHousehold(householdId);
    if (!household) {
      return null;
    }

    household.name = name;
    persistState();
    return household;
  },

  listHouseholdsByUser(userId: string) {
    const activeMemberships = new Set(
      getState()
        .householdMembers.filter((member) => member.userId === userId && member.status === "ACTIVE")
        .map((member) => member.householdId)
    );
    return getState().households.filter((household) => activeMemberships.has(household.id));
  },

  listMembersByHousehold(householdId: string) {
    return getState().householdMembers.filter((member) => member.householdId === householdId);
  },

  isOwnerOfAnyHousehold(userId: string) {
    return getState().households.some((household) => household.ownerUserId === userId);
  },

  inviteToHousehold(householdId: string, email: string, role: "OWNER" | "MEMBER") {
    const normalizedEmail = email.trim().toLowerCase();
    const invitedUserId = `invite_${normalizedEmail}`;
    const existing = getState().householdMembers.find(
      (member) => member.householdId === householdId && member.userId === invitedUserId && member.status !== "REMOVED"
    );

    if (existing) {
      return {
        member: existing,
        created: false
      };
    }

    const member: HouseholdMember = {
      householdId,
      userId: invitedUserId,
      role,
      status: "INVITED",
      createdAt: nowIso()
    };

    getState().householdMembers.push(member);
    persistState();
    return {
      member,
      created: true
    };
  },

  acceptHouseholdInvite(householdId: string, userId: string) {
    const member = getState().householdMembers.find((item) => item.householdId === householdId && item.userId === userId);
    if (!member) {
      return null;
    }

    member.status = "ACTIVE";
    persistState();
    return member;
  },

  saveAnnualReport(report: AnnualReport) {
    const state = getState();
    const index = state.annualReports.findIndex(
      (existing) => existing.userId === report.userId && existing.year === report.year
    );

    if (index >= 0) {
      state.annualReports[index] = report;
    } else {
      state.annualReports.push(report);
    }

    persistState();
    return report;
  },

  getAnnualReport(userId: string, year: number) {
    return getState().annualReports.find((report) => report.userId === userId && report.year === year) ?? null;
  },

  addAuditLog(input: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    getState().auditLogs.push({
      id: id("audit"),
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      createdAt: nowIso()
    });
    persistState();
  },

  listAuditLogs(userId?: string) {
    if (!userId) {
      return getState().auditLogs;
    }
    return getState().auditLogs.filter((log) => log.userId === userId);
  }
};
