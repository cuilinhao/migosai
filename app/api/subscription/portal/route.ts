import { getEnv, appOrigin } from "@/lib/server/env";
import { requireUser } from "@/lib/server/auth";
import { sameOrigin, jsonBody } from "@/lib/server/security";
import { createSubscriptionPortal } from "@/lib/server/subscriptions";
import { ApiError, api } from "@/lib/server/errors";
const handlePost = api(async (request) => {
  const env = await getEnv();
  sameOrigin(request, appOrigin(env));
  const user = await requireUser(request, env);
  if (user.isGuest) throw new ApiError(401, "Please sign in to manage your subscription.");
  const body = request.body ? await jsonBody(request) : {};
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ApiError(400, "Invalid subscription request.");
  return Response.json(await createSubscriptionPortal(env, user.id, body.locale));
});

export async function POST(request: Request, context: unknown) {
  const response = await handlePost(request, context);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
