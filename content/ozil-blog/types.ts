import type { BlogPost } from "../blog";

export type OzilBlogLanguage = "en" | "pt-BR" | "es";
export type OzilBlogTopic = "trend" | "viral" | "photo" | "apps" | "prompt" | "free" | "tutorial";

/** Each article is authored in its own language, independent of the site's UI locale. */
export type OzilBlogPost = BlogPost & {
  language: OzilBlogLanguage;
  topic: OzilBlogTopic;
};
