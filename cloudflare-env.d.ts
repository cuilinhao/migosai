interface CloudflareEnv {
 DB: D1Database; MEDIA: R2Bucket; ASSETS: Fetcher;
 APP_URL?: string;
 GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string;
 MEDIA_SIGNING_SECRET?: string; APIMART_API_KEY?: string;
 SEEAPI_API_KEY?: string;
 APIMART_MEDIA_HOSTS?: string;
 CREEM_API_KEY?: string; CREEM_WEBHOOK_SECRET?: string; CREEM_MODE?: string;
 CREEM_PRODUCT_STARTER?: string; CREEM_PRODUCT_CREATOR?: string;
 CREEM_PRODUCT_PRO?: string; CREEM_PRODUCT_BUSINESS?: string;
}
