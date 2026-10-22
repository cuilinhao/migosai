import { notFound, redirect } from 'next/navigation';
import { VideoWorkspace } from '@/components/video/video-workspace';
import { getEffectCreationHref, getEffectTemplate } from '@/content/effect-templates';
import { localizeHref } from '@/lib/i18n/routing';
import { getLocale, localizeMetadata } from '@/lib/i18n/server';

type Props = { params: Promise<{ slug: string }> };
async function resolveTemplate(params: Props['params']) {
  const { slug } = await params;
  const template = getEffectTemplate(slug);
  if (!template) notFound();
  return template;
}

export async function generateMetadata({ params }: Props) {
  const { effect } = await resolveTemplate(params);
  return localizeMetadata({ title: `${effect.title} Video Generator`, description: effect.description });
}

export default async function Page({ params }: Props) {
  const template = await resolveTemplate(params);
  const destination = getEffectCreationHref(template.effect);
  if (destination !== `/effects/${template.effect.id}`) redirect(localizeHref(destination, await getLocale()));
  return <VideoWorkspace key={template.effect.id} template={template}/>;
}
