import type { Locale, TranslatedLocale } from "../routing";
import type { Messages, Translator } from "../translator";

// Copy for the homepage campaign bar, the "Explore more AI video tools" cards and the extra footer row.
// Source, Traditional Chinese, Korean, Japanese, French, Spanish.
// These keys are merged with the lowest priority, so they can never change an existing translation.
type Row = readonly [string, string, string, string, string, string];
const rows: readonly Row[] = [
  // Campaign bar
  ["+{percent}% bonus credits on one-time credit packs, {start} – {end}.", "一次性點數包加贈 {percent}% 點數，{start} – {end}。", "일회성 크레딧 패키지 크레딧 {percent}% 추가 증정, {start} – {end}.", "買い切りクレジットパックのクレジットが{percent}%増量：{start} – {end}。", "+{percent} % de crédits bonus sur les packs de crédits à achat unique, du {start} au {end}.", "+{percent} % de créditos extra en paquetes de créditos de pago único, del {start} al {end}."],
  ["+{percent}% bonus credits on one-time credit packs, now through {end}.", "一次性點數包加贈 {percent}% 點數，優惠進行至 {end}。", "일회성 크레딧 패키지 크레딧 {percent}% 추가 증정, {end}까지 진행 중.", "買い切りクレジットパックのクレジットが{percent}%増量。{end}まで開催中。", "+{percent} % de crédits bonus sur les packs de crédits à achat unique, jusqu’au {end}.", "+{percent} % de créditos extra en paquetes de créditos de pago único, hasta el {end}."],
  ["+{percent}% bonus credits", "加贈 {percent}% 點數", "크레딧 {percent}% 추가", "クレジット{percent}%増量", "+{percent} % de crédits bonus", "+{percent} % de créditos extra"],
  ["Starts in {count} days", "{count} 天後開始", "{count}일 후 시작", "あと{count}日で開始", "Dans {count} jours", "Empieza en {count} días"],
  ["Starts tomorrow", "明天開始", "내일 시작", "明日開始", "Commence demain", "Empieza mañana"],
  ["{count} days left", "剩 {count} 天", "{count}일 남음", "残り{count}日", "Plus que {count} jours", "Quedan {count} días"],
  ["Last day", "最後一天", "마지막 날", "最終日", "Dernier jour", "Último día"],
  ["See the offer", "查看優惠", "혜택 보기", "特典を見る", "Voir l’offre", "Ver la oferta"],
  ["Get the offer", "立即領取優惠", "혜택 받기", "特典を受け取る", "Profiter de l’offre", "Aprovechar la oferta"],
  ["Dismiss announcement", "關閉公告", "공지 닫기", "お知らせを閉じる", "Fermer l’annonce", "Cerrar el aviso"],
  // Homepage cards
  ["More from MigosAI", "更多 MigosAI 工具", "MigosAI 더 보기", "MigosAIのその他のツール", "Plus d’outils MigosAI", "Más de MigosAI"],
  ["Explore more AI video tools", "探索更多 AI 影片工具", "더 많은 AI 영상 도구 살펴보기", "その他のAI動画ツール", "Découvrez d’autres outils vidéo IA", "Descubre más herramientas de vídeo con IA"],
  ["View all tools", "查看所有工具", "모든 도구 보기", "すべてのツールを見る", "Voir tous les outils", "Ver todas las herramientas"],
  ["New", "新", "신규", "新着", "Nouveau", "Nuevo"],
  ["Limited", "限時", "기간 한정", "期間限定", "Limité", "Limitado"],
  ["Starts soon", "即將開始", "곧 시작", "まもなく開始", "Bientôt", "Muy pronto"],
  ["Halloween", "萬聖節", "핼러윈", "ハロウィン", "Halloween", "Halloween"],
  ["Generator", "產生器", "생성기", "生成ツール", "Générateur", "Generador"],
  ["Video effect", "影片特效", "영상 효과", "動画エフェクト", "Effet vidéo", "Efecto de vídeo"],
  ["Video template", "影片範本", "영상 템플릿", "動画テンプレート", "Modèle vidéo", "Plantilla de vídeo"],
  ["Offer", "優惠", "혜택", "特典", "Offre", "Oferta"],
  ["Try it", "立即試用", "사용해 보기", "試してみる", "Essayer", "Probar"],
  ["bonus credits", "加贈點數", "추가 크레딧", "ボーナスクレジット", "crédits bonus", "créditos extra"],
  ["Starts {date}", "{date} 開始", "{date} 시작", "{date}開始", "Dès le {date}", "Empieza el {date}"],
  ["Bonus credits on one-time credit packs", "一次性點數包加贈點數", "일회성 크레딧 패키지 추가 크레딧", "買い切りクレジットパックのクレジット増量", "Crédits bonus sur les packs à achat unique", "Créditos extra en paquetes de pago único"],
  ["Turn a photo into a flying car video", "把照片變成飛天汽車影片", "사진 한 장을 플라잉카 영상으로", "写真を空飛ぶ車の動画に", "Transformez une photo en vidéo de voiture volante", "Convierte una foto en un vídeo de coche volador"],
  ["A Halloween runway walk down a lantern-lit hall", "在燈籠走廊上走一場萬聖節伸展台", "랜턴 복도를 걷는 핼러윈 런웨이", "ランタンの廊下を歩くハロウィンのランウェイ", "Un défilé d’Halloween dans un couloir éclairé de lanternes", "Un desfile de Halloween por un pasillo con faroles"],
  ["Fan out a stack of cash for the camera", "對著鏡頭秀出一疊鈔票", "카메라 앞에서 돈다발 펼치기", "カメラの前で札束を広げる", "Un éventail de billets face à la caméra", "Un abanico de billetes ante la cámara"],
  ["Wave goodbye and walk off to a waiting car", "揮手道別，走向等候的車", "손 흔들며 기다리는 차로 떠나기", "手を振って、待っている車へ", "Un signe de la main, puis direction la voiture", "Un adiós con la mano y rumbo al coche"],
  ["The orange booth and one mic, ready for two photos", "橘色錄音間和一支麥克風，只差你的兩張照片", "주황색 부스와 마이크 하나, 사진 두 장이면 준비 완료", "オレンジのブースとマイク1本。写真2枚で準備完了", "La cabine orange et un micro, prêts pour deux photos", "La cabina naranja y un micro, listos para dos fotos"],
  ["A sweet zombie-costume date on a foggy street", "霧氣街頭的殭屍裝甜蜜約會", "안개 낀 거리의 좀비 코스튬 데이트", "霧の街角でゾンビ姿のデート", "Un rendez-vous en costume de zombie dans une rue brumeuse", "Una cita disfrazados de zombis en una calle con niebla"],
  ["Put two faces in the booth without filming", "不用拍攝，把兩張臉放進錄音間", "촬영 없이 두 얼굴을 부스에", "撮影なしで2人の顔をブースへ", "Deux visages dans la cabine, sans tournage", "Dos caras en la cabina, sin grabar"],
  ["Your pet takes the stage as a dancing diva", "讓寵物登台當舞蹈天后", "반려동물이 무대 위 댄싱 디바로", "ペットがステージで踊るディーバに", "Votre animal devient une diva sur scène", "Tu mascota se convierte en diva del escenario"],
  // Footer row
  ["AI Generators", "AI 產生器", "AI 생성기", "AI生成ツール", "Générateurs IA", "Generadores con IA"],
  ["Video Effects", "影片特效", "영상 효과", "動画エフェクト", "Effets vidéo", "Efectos de vídeo"],
  ["Guides", "指南", "가이드", "ガイド", "Guides", "Guías"],
  ["Offers", "優惠活動", "혜택", "キャンペーン", "Offres", "Ofertas"],
  ["All video effects", "所有影片特效", "모든 영상 효과", "すべての動画エフェクト", "Tous les effets vidéo", "Todos los efectos de vídeo"],
  ["How to Make a Flying Car Video", "如何製作飛天汽車影片", "플라잉카 영상 만드는 법", "空飛ぶ車の動画の作り方", "Comment créer une vidéo de voiture volante", "Cómo hacer un vídeo de coche volador"],
  ["Tesla Flying Car AI Video Trend", "Tesla 飛天汽車 AI 影片趨勢", "Tesla 플라잉카 AI 영상 트렌드", "Tesla空飛ぶ車AI動画トレンド", "Tendance vidéo IA de la Tesla volante", "Tendencia de vídeos con IA del Tesla volador"],
  ["Ozil Goal AI Prompt", "Ozil 進球 AI 提示詞", "Ozil 골 AI 프롬프트", "OzilゴールAIプロンプト", "Prompt IA du but d’Ozil", "Prompt de IA del gol de Ozil"],
  ["Ozil Goal Trend", "Ozil 進球趨勢", "Ozil 골 트렌드", "Ozilゴールのトレンド", "Tendance du but d’Ozil", "Tendencia del gol de Ozil"],
  ["What Is a Hotel Lobby AI Video?", "什麼是 Hotel Lobby AI 影片？", "Hotel Lobby AI 영상이란?", "Hotel Lobby AI動画とは？", "Qu’est-ce qu’une vidéo Hotel Lobby AI ?", "¿Qué es un vídeo Hotel Lobby AI?"],
];

const locales = ["zh-TW", "ko", "ja", "fr", "es"] as const;
export const homeDiscoveryRows = rows;
export const homeDiscoveryMessages = Object.fromEntries(
  locales.map((locale, index) => [locale, Object.fromEntries(rows.map((row) => [row[0], row[index + 1]]))]),
) as Record<TranslatedLocale, Messages>;

// These titles already appear in existing navigation and effect pages. Keep their
// new translations scoped to discovery instead of changing the shared dictionary.
const titleRows: readonly Row[] = [
  ["Flying Car AI Generator", "飛天汽車 AI 產生器", "플라잉카 AI 생성기", "空飛ぶ車AI生成ツール", "Générateur IA de voiture volante", "Generador de coches voladores con IA"],
  ["Ozil Goal Generator", "Ozil 進球產生器", "Ozil 골 생성기", "Ozilゴール生成ツール", "Générateur de buts d’Ozil", "Generador de goles de Ozil"],
  ["Ramalama Costume Walk", "Ramalama 變裝走秀", "Ramalama 코스튬 워크", "Ramalama仮装ウォーク", "Défilé costumé Ramalama", "Desfile de disfraces Ramalama"],
  ["Money Flex", "鈔票炫富", "돈다발 플렉스", "札束アピール", "Liasse de billets", "Presume de billetes"],
  ["Hit The Road Dude AI Video", "揮手出發 AI 影片", "작별 인사 AI 영상", "さよなら出発AI動画", "Vidéo IA : salut et en route", "Vídeo con IA: adiós y en marcha"],
  ["Zombie Love Story", "殭屍愛情故事", "좀비 러브 스토리", "ゾンビのラブストーリー", "Histoire d’amour de zombies", "Historia de amor zombi"],
  ["Pet Diva Dance", "寵物天后舞蹈", "반려동물 디바 댄스", "ペットのディーバダンス", "Danse de diva pour animaux", "Baile de diva de mascotas"],
];
const titleMessages = Object.fromEntries(
  locales.map((locale, index) => [locale, Object.fromEntries(titleRows.map(row => [row[0], row[index + 1]]))]),
) as Record<TranslatedLocale, Messages>;

export function translateHomeDiscoveryTitle(source: string, locale: Locale, fallback: Translator): string {
  return (locale === "en" ? undefined : titleMessages[locale][source]) ?? fallback(source);
}
