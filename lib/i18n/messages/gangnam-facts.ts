import type { Locale } from '../routing';

type GangnamFactsCopy = {
  title: string;
  labels: { aspect: string; resolution: string; duration: string; audio: string; cost: string };
  duration: string;
  audio: string;
  cost: string;
  note: string;
  organizationDescription: string;
  independence: string;
};

export const gangnamFactsCopy: Record<Locale, GangnamFactsCopy> = {
  en: {
    title: 'Know your video before you create',
    labels: { aspect: 'Aspect ratio', resolution: 'Resolution', duration: 'Reference duration', audio: 'Soundtrack', cost: 'Credits per video' },
    duration: 'About {duration} seconds',
    audio: 'Template soundtrack included in the MP4',
    cost: '{resolution} · {credits} MigosAI credits',
    note: 'The same resolution-based cost applies to friends, selfie and pet modes. Finished duration can vary slightly. Review the credit cost before generating.',
    organizationDescription: 'MigosAI is an independent AI creative service.',
    independence: 'MigosAI is an independent AI creative service. This photo-to-video tool is not affiliated with or endorsed by PSY or YG Entertainment, and is separate from the 2012 Gangnam Style song and music video. Included template audio does not grant a separate music-use license.',
  },
  ko: {
    title: '만들기 전에 영상 사양을 확인하세요',
    labels: { aspect: '화면 비율', resolution: '해상도', duration: '참고 영상 길이', audio: '사운드트랙', cost: '영상당 크레딧' },
    duration: '약 {duration}초',
    audio: 'MP4에 템플릿 사운드트랙 포함',
    cost: '{resolution} · MigosAI 크레딧 {credits}개',
    note: '친구, 셀카, 반려동물 모드에는 해상도별로 동일한 비용이 적용됩니다. 완성된 영상의 길이는 조금 달라질 수 있습니다. 생성 전에 크레딧 비용을 확인하세요.',
    organizationDescription: 'MigosAI는 독립적인 AI 창작 서비스입니다.',
    independence: 'MigosAI는 독립적인 AI 창작 서비스입니다. 이 사진 기반 영상 도구는 PSY 또는 YG Entertainment와 제휴하거나 이들의 승인을 받은 서비스가 아니며, 2012년 강남스타일 노래 및 뮤직비디오와 별개입니다. 템플릿 오디오가 포함되어 있어도 별도의 음악 사용 허가가 부여되는 것은 아닙니다.',
  },
  ja: {
    title: '作成前に動画の仕様を確認',
    labels: { aspect: '画面比率', resolution: '解像度', duration: '参照動画の長さ', audio: '音源', cost: '動画1本のクレジット' },
    duration: '約{duration}秒',
    audio: 'MP4にテンプレート音源を収録',
    cost: '{resolution} · {credits} MigosAIクレジット',
    note: '友達・自撮り・ペットの各モードには、解像度ごとに同じ料金が適用されます。完成動画の長さは多少変わる場合があります。生成前にクレジット料金を確認してください。',
    organizationDescription: 'MigosAIは独立したAIクリエイティブサービスです。',
    independence: 'MigosAIは独立したAIクリエイティブサービスです。この写真から動画を作るツールはPSYやYG Entertainmentと提携しておらず、承認も受けていません。2012年の楽曲およびミュージックビデオ「江南スタイル」とは別のサービスです。テンプレート音源の収録は、別途の音楽利用許諾を意味しません。',
  },
  fr: {
    title: 'Connaissez votre vidéo avant de la créer',
    labels: { aspect: 'Format', resolution: 'Résolution', duration: 'Durée de la référence', audio: 'Bande-son', cost: 'Crédits par vidéo' },
    duration: 'Environ {duration} secondes',
    audio: 'Audio du modèle inclus dans le MP4',
    cost: '{resolution} · {credits} crédits MigosAI',
    note: 'Le même tarif par résolution s’applique aux modes amis, selfie et animaux. La durée finale peut varier légèrement. Vérifiez le coût en crédits avant de générer.',
    organizationDescription: 'MigosAI est un service indépendant de création par IA.',
    independence: 'MigosAI est un service indépendant de création par IA. Cet outil de création vidéo à partir de photos n’est ni affilié à PSY ou YG Entertainment, ni approuvé par eux. Il est distinct de la chanson et du clip Gangnam Style de 2012. L’audio du modèle inclus ne constitue pas une licence distincte d’utilisation musicale.',
  },
  es: {
    title: 'Conoce tu vídeo antes de crearlo',
    labels: { aspect: 'Relación de aspecto', resolution: 'Resolución', duration: 'Duración de la referencia', audio: 'Banda sonora', cost: 'Créditos por vídeo' },
    duration: 'Unos {duration} segundos',
    audio: 'Audio de la plantilla incluido en el MP4',
    cost: '{resolution} · {credits} créditos MigosAI',
    note: 'Los modos de amigos, selfie y mascotas tienen el mismo coste por resolución. La duración final puede variar ligeramente. Revisa el coste en créditos antes de generar.',
    organizationDescription: 'MigosAI es un servicio independiente de creación con IA.',
    independence: 'MigosAI es un servicio independiente de creación con IA. Esta herramienta de vídeo a partir de fotos no está afiliada a PSY ni a YG Entertainment, ni cuenta con su respaldo. Es independiente de la canción y el vídeo musical Gangnam Style de 2012. El audio incluido de la plantilla no concede una licencia independiente de uso musical.',
  },
  'zh-TW': {
    title: '製作前先了解影片規格',
    labels: { aspect: '畫面比例', resolution: '解析度', duration: '參考影片長度', audio: '配樂', cost: '每支影片所需點數' },
    duration: '約 {duration} 秒',
    audio: 'MP4 內含範本配樂',
    cost: '{resolution} · {credits} MigosAI 點數',
    note: '朋友、自拍與寵物模式皆採用相同的解析度計價。最終成片長度可能略有差異，生成前請確認所需點數。',
    organizationDescription: 'MigosAI 是獨立的 AI 創作服務。',
    independence: 'MigosAI 是獨立的 AI 創作服務。此照片轉影片工具與 PSY 或 YG Entertainment 沒有關聯，也未獲其背書，並獨立於 2012 年的 Gangnam Style 歌曲及音樂錄影帶。範本內含音訊不代表另行取得音樂使用授權。',
  },
};
