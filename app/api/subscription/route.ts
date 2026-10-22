import { getEnv } from "@/lib/server/env";
import { requireUser } from "@/lib/server/auth";
import { subscriptionStatus } from "@/lib/server/subscriptions";
import { api } from "@/lib/server/errors";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const env = await getEnv();
  const user = await requireUser(request, env);
  return Response.json(await subscriptionStatus(env, user.id), {
    headers: { "Cache-Control": "no-store" },
  });
});
