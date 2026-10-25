import { subscriptionPlans } from "@/content/pricing";
import { getEnv, appOrigin } from "@/lib/server/env";
import { requireUser } from "@/lib/server/auth";
import { sameOrigin, jsonBody } from "@/lib/server/security";
import { createCheckout } from "@/lib/server/payments";
import { createSubscriptionCheckout } from "@/lib/server/subscriptions";
import { ApiError, api } from "@/lib/server/errors";
export const POST = api(async (request) => {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  const body = await jsonBody(request);
  if (
    body.purchaseType &&
    body.purchaseType !== "credits" &&
    body.purchaseType !== "subscription"
  )
    throw new ApiError(400, "Unknown purchase type.");
  if (body.purchaseType === "subscription" && user.isGuest)
    throw new ApiError(401, "Please sign in to subscribe.");
  if ((user.isGuest || body.expectedUserId !== undefined) && body.expectedUserId !== user.id)
    throw new ApiError(409, "Your wallet changed. Refresh this page before checking out.");
  if (body.purchaseType === "subscription") {
    const plan = subscriptionPlans.find((item) => item.id === body.planId);
    if (!plan || (body.billingInterval !== "month" && body.billingInterval !== "year"))
      throw new ApiError(400, "Unknown subscription plan.");
    const amount = body.billingInterval === "month" ? plan.monthlyPriceCents : plan.yearlyPriceCents;
    if (body.expectedCredits !== plan.credits || body.expectedAmountCents !== amount)
      throw new ApiError(409, "This subscription offer has changed. Refresh pricing before you check out.");
  }
  const checkout = body.purchaseType === "subscription"
      ? await createSubscriptionCheckout(
          env,
          user,
          body.planId,
          body.billingInterval,
          body.locale,
        )
      : await createCheckout(env, user, body.packId, body.locale, body.expectedCredits);
  return Response.json({ ...checkout, buyerId: user.id }, {
    headers: { "Cache-Control": "no-store" },
  });
});
