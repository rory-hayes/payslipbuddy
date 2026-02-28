import { inMemoryDb } from "@/lib/db/in-memory-db";
import { badRequest, forbidden, notFound, parseBody, serverError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { checkoutBodySchema } from "@/lib/validation/schemas";

function priceIdFromPlan(planTier: "PLUS" | "PRO", billingCycle: "monthly" | "annual"): string | null {
  if (planTier === "PLUS" && billingCycle === "monthly") {
    return process.env.STRIPE_PRICE_PLUS_MONTHLY ?? null;
  }
  if (planTier === "PLUS" && billingCycle === "annual") {
    return process.env.STRIPE_PRICE_PLUS_ANNUAL ?? null;
  }
  if (planTier === "PRO" && billingCycle === "monthly") {
    return process.env.STRIPE_PRICE_PRO_MONTHLY ?? null;
  }

  return process.env.STRIPE_PRICE_PRO_ANNUAL ?? null;
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, checkoutBodySchema);
    if ("error" in body) {
      return body.error;
    }

    const user = inMemoryDb.getUser(body.data.userId);
    if (!user) {
      return notFound("User not found.");
    }

    if (!inMemoryDb.isOwnerOfAnyHousehold(user.id)) {
      return forbidden("Only household owners can manage billing.");
    }

    const priceId = priceIdFromPlan(body.data.planTier, body.data.billingCycle);

    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
      inMemoryDb.addAuditLog({
        userId: user.id,
        action: "CHECKOUT_CREATED_MOCK",
        entity: "billing_checkout",
        metadata: { planTier: body.data.planTier, billingCycle: body.data.billingCycle }
      });
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            checkoutUrl: `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/billing?mock=1&tier=${body.data.planTier}&cycle=${body.data.billingCycle}`,
            mode: "mock"
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.data.successUrl,
      cancel_url: body.data.cancelUrl,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        planTier: body.data.planTier,
        billingCycle: body.data.billingCycle
      }
    });

    inMemoryDb.addAuditLog({
      userId: user.id,
      action: "CHECKOUT_CREATED",
      entity: "billing_checkout",
      entityId: session.id,
      metadata: { planTier: body.data.planTier, billingCycle: body.data.billingCycle }
    });

    return new Response(JSON.stringify({ ok: true, data: { checkoutUrl: session.url, mode: "stripe" } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (error) {
    console.error(error);
    return serverError("Failed to create checkout session.");
  }
}

export async function GET() {
  return badRequest("Use POST for checkout creation.");
}
