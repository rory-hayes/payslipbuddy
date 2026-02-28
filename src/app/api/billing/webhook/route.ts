import Stripe from "stripe";
import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, ok, serverError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";

declare global {
  // eslint-disable-next-line no-var
  var __PAYSLIP_BUDDY_STRIPE_EVENTS__: Set<string> | undefined;
}

function seenEvents(): Set<string> {
  if (!globalThis.__PAYSLIP_BUDDY_STRIPE_EVENTS__) {
    globalThis.__PAYSLIP_BUDDY_STRIPE_EVENTS__ = new Set<string>();
  }
  return globalThis.__PAYSLIP_BUDDY_STRIPE_EVENTS__;
}

function mapStripeStatus(status: string): "ACTIVE" | "PAST_DUE" | "CANCELED" {
  if (status === "active" || status === "trialing") {
    return "ACTIVE";
  }

  if (status === "past_due" || status === "unpaid") {
    return "PAST_DUE";
  }

  return "CANCELED";
}

function applyPlan(userId: string, planTier?: string, billingCycle?: string) {
  const user = inMemoryDb.getUser(userId);
  if (!user) {
    return;
  }

  const nextPlan = planTier === "PRO" ? "PRO" : planTier === "PLUS" ? "PLUS" : user.plan;
  const nextCycle =
    billingCycle === "annual"
      ? "ANNUAL"
      : billingCycle === "monthly"
        ? "MONTHLY"
        : user.billingCycle;

  inMemoryDb.setUserPlanAndCycle(userId, nextPlan, nextCycle);
}

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
      const payload = await request.json();
      const userId = payload?.userId;
      const status = payload?.status;
      const planTier = payload?.planTier;
      const billingCycle = payload?.billingCycle;

      if (typeof userId !== "string" || typeof status !== "string") {
        return badRequest("Mock webhook requires userId and status.");
      }

      const mapped = mapStripeStatus(status);
      inMemoryDb.setSubscriptionStatus(userId, mapped);
      if (mapped === "ACTIVE") {
        applyPlan(userId, planTier, billingCycle);
      }

      inMemoryDb.addAuditLog({
        userId,
        action: "BILLING_WEBHOOK_MOCK",
        entity: "subscription",
        metadata: { mappedStatus: mapped, planTier, billingCycle }
      });

      return ok({ mode: "mock", userId, mappedStatus: mapped });
    }

    const stripe = getStripe();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return badRequest("Missing stripe-signature header.");
    }

    const rawBody = await request.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret) as Stripe.Event;

    if (seenEvents().has(event.id)) {
      return ok({ received: true, duplicate: true, eventId: event.id });
    }

    seenEvents().add(event.id);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const planTier = session.metadata?.planTier;
      const billingCycle = session.metadata?.billingCycle;

      if (userId) {
        inMemoryDb.setSubscriptionStatus(userId, "ACTIVE");
        applyPlan(userId, planTier, billingCycle);
        inMemoryDb.addAuditLog({
          userId,
          action: "SUBSCRIPTION_ACTIVATED",
          entity: "subscription",
          metadata: { eventId: event.id, planTier, billingCycle }
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;

      if (userId) {
        inMemoryDb.setSubscriptionStatus(userId, mapStripeStatus(subscription.status));
        inMemoryDb.addAuditLog({
          userId,
          action: "SUBSCRIPTION_UPDATED",
          entity: "subscription",
          metadata: { eventId: event.id, status: subscription.status }
        });
      }
    }

    return ok({ received: true, eventType: event.type, eventId: event.id });
  } catch (error) {
    console.error(error);
    return serverError("Failed to process Stripe webhook.");
  }
}
