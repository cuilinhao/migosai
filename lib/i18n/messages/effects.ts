import type { TranslatedLocale } from "../routing";

type Row = readonly [string, string, string, string, string, string];
const rows: readonly Row[] = [
  ["Video effect preview", "影片特效預覽", "영상 효과 미리보기", "動画エフェクトのプレビュー", "Aperçu de l’effet vidéo", "Vista previa del efecto de vídeo"],
  ["Previous video", "上一部影片", "이전 영상", "前の動画", "Vidéo précédente", "Vídeo anterior"],
  ["Next video", "下一部影片", "다음 영상", "次の動画", "Vidéo suivante", "Vídeo siguiente"],
  ["Loading video…", "正在載入影片…", "영상 불러오는 중…", "動画を読み込み中…", "Chargement de la vidéo…", "Cargando vídeo…"],
  ["Could not load this video.", "無法載入此影片。", "이 영상을 불러올 수 없습니다.", "この動画を読み込めませんでした。", "Impossible de charger cette vidéo.", "No se pudo cargar este vídeo."],
  ["Retry video", "重新載入影片", "영상 다시 불러오기", "動画を再読み込み", "Recharger la vidéo", "Volver a cargar el vídeo"],
  ["Back to effects", "返回特效", "효과로 돌아가기", "エフェクトに戻る", "Retour aux effets", "Volver a los efectos"],
  ["Effect preview", "特效示範", "효과 미리보기", "エフェクトのプレビュー", "Aperçu de l’effet", "Vista previa del efecto"],
  ["Reset prompt", "重設提示詞", "프롬프트 초기화", "プロンプトをリセット", "Réinitialiser", "Restablecer descripción"],
  ["Add your photo, adjust the prepared prompt, and generate your version.", "加入你的照片，調整預填的提示詞，製作你的版本。", "사진을 추가하고 준비된 프롬프트를 수정해 나만의 영상을 만드세요.", "写真を追加し、用意されたプロンプトを調整して、自分だけの動画を生成しましょう。", "Ajoutez votre photo, adaptez la description préparée et générez votre version.", "Añade tu foto, ajusta la descripción preparada y genera tu versión."],
  ["Your version is generated from your photo and the prompt. The preview is a reference.", "你的影片將依照片與提示詞生成，示範影片供參考。", "사진과 프롬프트를 바탕으로 영상이 생성됩니다. 미리보기는 참고용입니다.", "写真とプロンプトから動画を生成します。プレビューは参考映像です。", "Votre version est générée à partir de votre photo et de la description. L’aperçu sert de référence.", "Tu versión se genera a partir de tu foto y la descripción. La vista previa sirve como referencia."],
  ["{current} of {total}", "第 {current} / {total} 部", "{total}개 중 {current}번째", "{total}件中{current}件目", "{current} sur {total}", "{current} de {total}"],
];

const locales = ["zh-TW", "ko", "ja", "fr", "es"] as const;
export const effectsMessages = Object.fromEntries(locales.map((locale, index) => [locale, Object.fromEntries(rows.map(row => [row[0], row[index + 1]]))])) as Record<TranslatedLocale, Record<string, string>>;
