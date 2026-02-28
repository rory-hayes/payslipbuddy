import { z } from "zod";

const nonNegative = z.number().finite().nonnegative();

export const payslipLineItemSchema = z.object({
  type: z.enum(["EARNING", "DEDUCTION", "TAX"]),
  label: z.string().min(1),
  amount: z.number().finite(),
  confidence: z.number().min(0).max(1).optional(),
  editedByUser: z.boolean().optional()
});

export const parsedPayslipSchema = z.object({
  schemaVersion: z.string().min(1),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2000).max(2100),
  employerName: z.string().min(1),
  gross: nonNegative,
  net: nonNegative,
  tax: nonNegative,
  pension: nonNegative,
  niOrPrsi: nonNegative,
  usc: nonNegative.optional().nullable(),
  bonuses: z.number().finite().optional().nullable(),
  overtime: z.number().finite().optional().nullable(),
  lineItems: z.array(payslipLineItemSchema).default([]),
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  validationErrors: z.array(z.string()).default([]),
  editedFields: z.record(z.string(), z.boolean()).default({})
});

export const confirmPayslipBodySchema = z.object({
  parsed: parsedPayslipSchema,
  confidence: z.number().min(0).max(1),
  notes: z.string().max(500).optional().nullable(),
  replaceExisting: z.boolean().optional().default(false)
});

export const uploadPayslipBodySchema = z.object({
  userId: z.string().min(1),
  employerId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  storagePath: z.string().min(1)
});

export const csvImportBodySchema = z.object({
  userId: z.string().min(1),
  fileName: z.string().min(1),
  mapping: z.object({
    date: z.string().min(1),
    description: z.string().min(1),
    amount: z.string().min(1)
  }),
  csvText: z.string().min(1)
});

export const createExpenseBodySchema = z.object({
  userId: z.string().min(1),
  householdId: z.string().min(1),
  category: z.string().min(1),
  kind: z.enum(["RECURRING", "UPCOMING", "ONE_OFF"]),
  amount: nonNegative,
  dueDate: z.string().optional().nullable(),
  recurrence: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const inviteHouseholdBodySchema = z.object({
  householdId: z.string().min(1),
  invitedBy: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["OWNER", "MEMBER"]).default("MEMBER")
});

export const checkoutBodySchema = z.object({
  userId: z.string().min(1),
  planTier: z.enum(["PLUS", "PRO"]),
  billingCycle: z.enum(["monthly", "annual"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
});
