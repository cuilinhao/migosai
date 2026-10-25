import { getEnv, appOrigin } from "@/lib/server/env";
import { requireUser } from "@/lib/server/auth";
import { sameOrigin } from "@/lib/server/security";
import { createSubscriptionPortal } from "@/lib/server/subscriptions";
import { ApiError, api } from "@/lib/server/errors";
export const POST = api(async (request) => {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  if (user.isGuest) throw new ApiError(401, "Please sign in to manage your subscription.");
  return Response.json(await createSubscriptionPortal(env, user.id), {
    headers: { "Cache-Control": "no-store" },
  });
});
