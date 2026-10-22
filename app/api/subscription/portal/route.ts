import { getEnv, appOrigin } from "@/lib/server/env";
import { requireUser } from "@/lib/server/auth";
import { sameOrigin } from "@/lib/server/security";
import { createSubscriptionPortal } from "@/lib/server/subscriptions";
import { api } from "@/lib/server/errors";
export const POST = api(async (request) => {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  return Response.json(await createSubscriptionPortal(env, user.id), {
    headers: { "Cache-Control": "no-store" },
  });
});
