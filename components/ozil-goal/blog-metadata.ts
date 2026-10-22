import type { Metadata } from "next";
import { SITE_URL } from "@/content/public-pages";
import { OZIL_BLOG_PATH, ozilBlogAlternates } from "@/content/ozil-blog";
import type { OzilBlogPost } from "@/content/ozil-blog/types";
import { ozilBlogText } from "./blog-ui";

export function ozilBlogMetadata(post?: OzilBlogPost): Metadata {
  const title = post?.metaTitle ?? "Ozil Goal Blog: AI Video Guides in English, Português & Español";
  const description = ozilBlogText(post?.description ?? "Understand the Ozil Goal TikTok trend, make an AI football video with your photo, compare tools and learn about prompts and costs. Guides in three languages.");
  const url = `${SITE_URL}${post?.path ?? OZIL_BLOG_PATH}`;
  const languages = post ? ozilBlogAlternates(post) : { en: OZIL_BLOG_PATH, "x-default": OZIL_BLOG_PATH };
  return {
    title: { absolute: title }, description,
    alternates: { canonical: url, languages: Object.fromEntries(Object.entries(languages).map(([language, path]) => [language, `${SITE_URL}${path}`])) },
    openGraph: {
      title, description, url, siteName: "MigosAI", type: post ? "article" : "website",
      locale: post?.language === "pt-BR" ? "pt_BR" : post?.language === "es" ? "es_ES" : "en_US",
      images: [{ url: "/ozil-goal/samples/ai-shot1.jpg", width: 496, height: 864, alt: "AI football scene from the Ozil Goal reference sample" }],
      ...(post ? { publishedTime: post.datePublished, modifiedTime: post.dateModified } : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: ["/ozil-goal/samples/ai-shot1.jpg"] },
  };
}
