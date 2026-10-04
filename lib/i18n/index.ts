import { pageMessages } from "./messages/pages";
import { sharedMessages } from "./messages/shared";
import { interactiveMessages } from "./messages/interactive";
import { videoExampleMessages } from "./messages/video-examples";
import { videoCustomizationMessages } from "./messages/video-customization";
import { authMessages } from "./messages/auth";
import { homeHeroMessages } from "./messages/home-hero";
import { createTranslator, type Messages, type Values } from "./translator";
import type { Locale } from "./routing";
export * from "./routing";
export * from "./translator";
const rootMessages: Record<Exclude<Locale, "en">, Messages> = {
  "zh-TW": { "Hotel Lobby AI Video Generator | LobbyDuo": "Hotel Lobby AI 影片產生器 | LobbyDuo", "Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo.": "使用 LobbyDuo，將兩張照片製作成 Hotel Lobby 風格的 AI 雙人影片。" },
  ko: { "Hotel Lobby AI Video Generator | LobbyDuo": "Hotel Lobby AI 동영상 생성기 | LobbyDuo", "Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo.": "LobbyDuo로 사진 두 장을 Hotel Lobby 스타일의 AI 듀오 동영상으로 만들어 보세요." },
  ja: { "Hotel Lobby AI Video Generator | LobbyDuo": "Hotel Lobby AI動画生成ツール | LobbyDuo", "Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo.": "LobbyDuoで2枚の写真からHotel LobbyスタイルのAIデュオ動画を作成。" },
  fr: { "Hotel Lobby AI Video Generator | LobbyDuo": "Générateur vidéo IA Hotel Lobby | LobbyDuo", "Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo.": "Créez des vidéos de duo dans le style Hotel Lobby à partir de deux photos avec LobbyDuo." },
  es: { "Hotel Lobby AI Video Generator | LobbyDuo": "Generador de vídeos con IA Hotel Lobby | LobbyDuo", "Create Hotel Lobby–style AI duo videos from two photos with LobbyDuo.": "Crea vídeos de dúos al estilo Hotel Lobby a partir de dos fotos con LobbyDuo." },
};
export function getMessages(locale: Locale): Messages {
  return locale === "en" ? {} : { ...rootMessages[locale], ...pageMessages[locale], ...sharedMessages[locale], ...interactiveMessages[locale], ...videoExampleMessages[locale], ...videoCustomizationMessages[locale], ...authMessages[locale], ...homeHeroMessages[locale] };
}
export function translate(locale: Locale, source: string, values?: Values) { return createTranslator(getMessages(locale))(source, values); }
