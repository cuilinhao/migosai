import { pageMessages } from "./messages/pages";
import { sharedMessages } from "./messages/shared";
import { interactiveMessages } from "./messages/interactive";
import { videoExampleMessages } from "./messages/video-examples";
import { videoCustomizationMessages } from "./messages/video-customization";
import { createTranslator, type Messages, type Values } from "./translator";
import type { Locale } from "./routing";
export * from "./routing";
export * from "./translator";
const rootMessages: Record<Exclude<Locale, "en">, Messages> = {
  "zh-TW": { "Migos AI | Hotel Lobby AI Video Generator": "Migos AI | Hotel Lobby AI 影片產生器", "Create Hotel Lobby–style AI duo videos from two photos with Migos AI.": "使用 Migos AI，將兩張照片製作成 Hotel Lobby 風格的 AI 雙人影片。" },
  ko: { "Migos AI | Hotel Lobby AI Video Generator": "Migos AI | Hotel Lobby AI 동영상 생성기", "Create Hotel Lobby–style AI duo videos from two photos with Migos AI.": "Migos AI로 사진 두 장을 Hotel Lobby 스타일의 AI 듀오 동영상으로 만들어 보세요." },
  ja: { "Migos AI | Hotel Lobby AI Video Generator": "Migos AI | Hotel Lobby AI動画生成ツール", "Create Hotel Lobby–style AI duo videos from two photos with Migos AI.": "Migos AIで2枚の写真からHotel LobbyスタイルのAIデュオ動画を作成。" },
  fr: { "Migos AI | Hotel Lobby AI Video Generator": "Migos AI | Générateur vidéo IA Hotel Lobby", "Create Hotel Lobby–style AI duo videos from two photos with Migos AI.": "Créez des vidéos de duo dans le style Hotel Lobby à partir de deux photos avec Migos AI." },
  es: { "Migos AI | Hotel Lobby AI Video Generator": "Migos AI | Generador de vídeos con IA Hotel Lobby", "Create Hotel Lobby–style AI duo videos from two photos with Migos AI.": "Crea vídeos de dúos al estilo Hotel Lobby a partir de dos fotos con Migos AI." },
};
export function getMessages(locale: Locale): Messages {
  return locale === "en" ? {} : { ...rootMessages[locale], ...pageMessages[locale], ...sharedMessages[locale], ...interactiveMessages[locale], ...videoExampleMessages[locale], ...videoCustomizationMessages[locale] };
}
export function translate(locale: Locale, source: string, values?: Values) { return createTranslator(getMessages(locale))(source, values); }
