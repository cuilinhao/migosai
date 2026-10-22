import type { TranslatedLocale } from "../routing";

type Row = readonly [string, string, string, string, string, string];
const rows: readonly Row[] = [
  ["Video effect preview", "影片特效預覽", "영상 효과 미리보기", "動画エフェクトのプレビュー", "Aperçu de l’effet vidéo", "Vista previa del efecto de vídeo"],
  ["Previous video", "上一部影片", "이전 영상", "前の動画", "Vidéo précédente", "Vídeo anterior"],
  ["Next video", "下一部影片", "다음 영상", "次の動画", "Vidéo suivante", "Vídeo siguiente"],
  ["Loading video…", "正在載入影片…", "영상 불러오는 중…", "動画を読み込み中…", "Chargement de la vidéo…", "Cargando vídeo…"],
  ["Could not load this video.", "無法載入此影片。", "이 영상을 불러올 수 없습니다.", "この動画を読み込めませんでした。", "Impossible de charger cette vidéo.", "No se pudo cargar este vídeo."],
  ["Retry video", "重新載入影片", "영상 다시 불러오기", "動画を再読み込み", "Recharger la vidéo", "Volver a cargar el vídeo"],
  ["View original", "查看原始來源", "원본 보기", "元の作品を見る", "Voir l’original", "Ver original"],
  ["{current} of {total}", "第 {current} / {total} 部", "{total}개 중 {current}번째", "{total}件中{current}件目", "{current} sur {total}", "{current} de {total}"],
];

const locales = ["zh-TW", "ko", "ja", "fr", "es"] as const;
export const effectsMessages = Object.fromEntries(locales.map((locale, index) => [locale, Object.fromEntries(rows.map(row => [row[0], row[index + 1]]))])) as Record<TranslatedLocale, Record<string, string>>;
