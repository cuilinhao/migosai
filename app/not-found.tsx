import Link from 'next/link';
import { headers } from 'next/headers';
import { GANGNAM_BLOG_PATH, GANGNAM_GENERATOR_PATH } from '@/content/gangnam-style-blog/shared';
import { notFoundMessages } from '@/lib/i18n/not-found';
import { localizeHref } from '@/lib/i18n/routing';
import { getLocale } from '@/lib/i18n/server';
import styles from './not-found.module.css';

export default async function NotFound() {
  const locale = await getLocale();
  const copy = notFoundMessages[locale];
  const pathname = (await headers()).get('x-migos-pathname') ?? '/';
  const blogPath = pathname === GANGNAM_GENERATOR_PATH || pathname.startsWith(`${GANGNAM_GENERATOR_PATH}/`) ? GANGNAM_BLOG_PATH : '/blog';

  return <section className={styles.page} aria-labelledby="not-found-title">
    <p className={styles.code}>404</p>
    <h1 id="not-found-title">{copy.title}</h1>
    <p className={styles.description}>{copy.description}</p>
    <div className={styles.actions}>
      <Link className={styles.primary} href={localizeHref('/', locale)}>{copy.home}</Link>
      <Link className={styles.secondary} href={localizeHref(blogPath, locale)}>{copy.blog}</Link>
    </div>
  </section>;
}
