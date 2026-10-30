import { explainerPosts } from './explainers';
import { practicalPosts } from './practical';
export { GANGNAM_BLOG_PATH, GANGNAM_BLOG_UPDATED, GANGNAM_BLOG_INDEX_UPDATED, GANGNAM_GENERATOR_PATH } from './shared';

const order = ['what-is-gangnam-style', 'what-does-gangnam-style-mean', 'how-to-make-gangnam-style-ai-video', 'best-photos-for-gangnam-style-ai-video', 'gangnam-style-ai-video-from-one-selfie', 'gangnam-style-ai-pet-video', 'gangnam-style-ai-video-prompt', 'gangnam-style-ai-video-music', 'gangnam-style-ai-video-format-resolution', 'gangnam-style-ai-video-cost-and-fixes'];
export const gangnamBlogPosts = [...explainerPosts, ...practicalPosts].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
export const getGangnamBlogPost = (slug: string) => gangnamBlogPosts.find(post => post.slug === slug);
