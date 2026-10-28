import ko from './messages/gangnam-ui/ko.json';
import ja from './messages/gangnam-ui/ja.json';
import fr from './messages/gangnam-ui/fr.json';
import es from './messages/gangnam-ui/es.json';
import zhTW from './messages/gangnam-ui/zh-TW.json';
import { createTranslator, type Messages } from './translator';
import type { Locale } from './routing';

export const gangnamUiMessages: Record<Locale, Messages> = { en: {}, ko, ja, fr, es, 'zh-TW': zhTW };
export function getGangnamTranslator(locale: Locale) { return createTranslator(gangnamUiMessages[locale]); }
