import { subscriptionPlans } from "@/content/pricing";
import { getEnv, appOrigin } from "@/lib/server/env";
import { requireUser } from "@/lib/server/auth";
import { sameOrigin, jsonBody } from "@/lib/server/security";
import { createSubscriptionChange } from "@/lib/server/subscriptions";
import { ApiError, api } from "@/lib/server/errors";

const handlePost = api(async request => {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  if (user.isGuest) throw new ApiError(401, "Please sign in to manage your subscription.");
  const body = await jsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Invalid subscription request.");
  if (typeof body.subscriptionId !== "string" || !body.subscriptionId.trim() || body.subscriptionId.length > 200) throw new ApiError(400, "Invalid subscription identifier.");
  if (body.expectedUserId !== user.id) throw new ApiError(409, "Your wallet changed. Refresh this page before checking out.");
  const plan = subscriptionPlans.find(plan => plan.id === body.planId);
  if (!plan || !["month", "year"].includes(body.billingInterval)) throw new ApiError(400, "Unknown subscription plan.");
  if (body.expectedCredits !== plan.credits || body.expectedAmountCents !== (body.billingInterval === "month" ? plan.monthlyPriceCents : plan.yearlyPriceCents))
    throw new ApiError(409, "This subscription offer has changed. Refresh pricing before you check out.");
  return Response.json(await createSubscriptionChange(env, user.id, body.subscriptionId, body.planId, body.billingInterval, body.locale));
});
export async function POST(request: Request, context: unknown) {
  const response = await handlePost(request, context);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
