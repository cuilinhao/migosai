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
  return Response.json(
    body.purchaseType === "subscription"
      ? await createSubscriptionCheckout(
          env,
          user,
          body.planId,
          body.billingInterval,
          body.locale,
        )
      : await createCheckout(env, user, body.packId, body.locale),
  );
});
