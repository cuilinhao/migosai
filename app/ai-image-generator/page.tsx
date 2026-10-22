import { ImageGenerator } from '@/components/image/image-generator';
import { localizeMetadata } from '@/lib/i18n/server';

export async function generateMetadata() {
  return localizeMetadata({ title:'AI Image Generator', description:'Create private AI images with Nano Banana 2. Turn text and up to 10 reference images into 1K, 2K, or 4K images.' });
}
export default function ImageGeneratorPage() { return <ImageGenerator/>; }
