import { getEnv,authConfigured } from '@/lib/server/env';
import { currentUser, oneTapConfigured, emailAuthConfigured } from '@/lib/server/auth';
import { api } from '@/lib/server/errors';
export const dynamic='force-dynamic';
export const GET=api(async(request)=>{const env=await getEnv();const user=await currentUser(request,env);return Response.json({user:user?{id:user.id,name:user.name,email:user.email,picture:user.picture}:null,credits:user?.credits??0,permanentCredits:user?.permanentCredits??0,subscriptionCredits:user?.subscriptionCredits??0,subscriptionCreditsExpireAt:user?.subscriptionCreditsExpireAt?new Date(user.subscriptionCreditsExpireAt*1000).toISOString():null,authConfigured:authConfigured(env),googleClientId:oneTapConfigured(env)?env.GOOGLE_CLIENT_ID:null,emailAuthConfigured:emailAuthConfigured(env)},{headers:{'Cache-Control':'no-store'}});});
