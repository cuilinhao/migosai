import { englishPosts } from "./en";
import { portuguesePosts } from "./pt";
import { spanishPosts } from "./es";
import type { OzilBlogPost } from "./types";

export const OZIL_BLOG_PATH = "/ozil-goal-generator/blog";
export const OZIL_BLOG_UPDATED = "2026-10-15";
export const ozilBlogPosts: OzilBlogPost[] = [...englishPosts, ...portuguesePosts, ...spanishPosts];
export const ozilBlogLanguages = [
  { language: "en", label: "English", description: "The trend, the tools, photo tutorials and what free really means." },
  { language: "pt-BR", label: "Português", description: "Entenda a trend do gol do Özil e aprenda a criar seu vídeo com IA." },
  { language: "es", label: "Español", description: "Qué es el gol de Özil con IA, cómo usar tu foto y qué opciones son gratis." },
] as const;

export function getOzilBlogPost(slug: string): OzilBlogPost | undefined {
  return ozilBlogPosts.find(post => post.slug === slug);
}

/** Only link corresponding articles that actually exist, never synthetic translations. */
export function ozilBlogAlternates(post: OzilBlogPost): Record<string, string> {
  const related = ozilBlogPosts.filter(candidate => candidate.topic === post.topic);
  return Object.fromEntries([
    ...related.map(candidate => [candidate.language, candidate.path]),
    ["x-default", (related.find(candidate => candidate.language === "en") ?? related[0]).path],
  ]);
}
