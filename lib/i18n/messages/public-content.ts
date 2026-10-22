import type { TranslatedLocale } from '../routing';

// Corrections to public guides use their own catalog so existing policy and
// page catalogs retain their established wording and source keys.
type Row = readonly [source: string, ko: string, ja: string, fr: string, es: string, zhTW: string];
const rows: readonly Row[] = [
  ['Suggested starting settings for your own Wan template: two clear portraits, 9:16, 5 seconds, 480p ({credits} credits).',
    'Wan 템플릿의 권장 시작 설정: 선명한 인물 사진 두 장, 9:16, 5초, 480p({credits} 크레딧).',
    'Wanテンプレートの推奨初期設定：鮮明な人物写真2枚、9:16、5秒、480p（{credits}クレジット）。',
    'Réglages de départ conseillés pour votre modèle Wan : deux portraits nets, 9:16, 5 secondes, 480p ({credits} crédits).',
    'Ajustes iniciales recomendados para la plantilla Wan: dos retratos nítidos, 9:16, 5 segundos, 480p ({credits} créditos).',
    'Wan 範本的建議起始設定：兩張清晰人像照、9:16、5 秒、480p（{credits} 點數）。'],
  ['You can read the guides and watch reference clips without an account. Uploading photos and submitting a video require sign-in. Choose an available sign-in method and create an account first if prompted.',
    '계정 없이 가이드를 읽고 참고 영상을 볼 수 있습니다. 사진을 업로드하고 영상을 제출하려면 로그인해야 합니다. 사용 가능한 로그인 방법을 선택하고 안내가 나오면 먼저 계정을 만드세요.',
    'アカウントがなくてもガイドや参考動画を閲覧できます。写真のアップロードと動画の生成にはログインが必要です。利用可能なログイン方法を選び、案内が表示された場合は先にアカウントを作成してください。',
    'Vous pouvez lire les guides et regarder les vidéos de référence sans compte. Vous devez vous connecter pour importer des photos et lancer une vidéo. Choisissez une méthode de connexion disponible et créez d’abord un compte si cela vous est demandé.',
    'Puedes leer las guías y ver los vídeos de referencia sin una cuenta. Para subir fotos y generar un vídeo debes iniciar sesión. Elige un método de acceso disponible y crea una cuenta primero si se te solicita.',
    '無須帳戶即可閱讀指南與觀看參考影片。上傳照片與提交影片生成需要登入。請選擇可用的登入方式，若系統提示，請先建立帳戶。'],
  ['Use the website directly. MigosAI has no separate native app to install. Sign-in and sufficient credits are required to generate.',
    '웹사이트를 바로 이용하세요. MigosAI에는 별도로 설치할 네이티브 앱이 없습니다. 생성하려면 로그인과 충분한 크레딧이 필요합니다.',
    'ウェブサイトをそのままご利用ください。MigosAIには別途インストールするネイティブアプリはありません。生成にはログインと十分なクレジットが必要です。',
    'Utilisez directement le site Web. MigosAI n’a pas d’application native distincte à installer. Une connexion et suffisamment de crédits sont nécessaires pour générer.',
    'Usa directamente el sitio web. MigosAI no tiene una aplicación nativa independiente que instalar. Para generar, debes iniciar sesión y tener suficientes créditos.',
    '直接使用網站即可。MigosAI 沒有需要另外安裝的原生應用程式。生成需要登入及足夠點數。'],
  ['Use the <0>reference video gallery</0> to understand the visual style. It includes MigosAI-generated examples and third-party reference clips, with sources identified in their captions. For the full feature overview and the working form, visit the <1>Hotel Lobby AI Video Generator</1>.',
    '<0>참고 영상 갤러리</0>에서 시각적 스타일을 살펴보세요. MigosAI로 생성한 예시와 외부 참고 영상이 함께 있으며, 각 설명에 출처가 표시되어 있습니다. 전체 기능과 생성 양식은 <1>Hotel Lobby AI 영상 생성기</1>에서 확인하세요.',
    '<0>参考動画ギャラリー</0>で映像のスタイルをご覧ください。MigosAIで生成した作例と第三者の参考動画があり、それぞれの説明に出典を表示しています。機能の詳細と生成フォームは<1>Hotel Lobby AI動画ジェネレーター</1>をご覧ください。',
    'Consultez la <0>galerie de vidéos de référence</0> pour découvrir le style visuel. Elle comprend des exemples générés avec MigosAI et des clips de référence tiers dont les légendes indiquent la source. Pour découvrir toutes les fonctions et le formulaire, ouvrez le <1>générateur vidéo IA Hotel Lobby</1>.',
    'Consulta la <0>galería de vídeos de referencia</0> para conocer el estilo visual. Incluye ejemplos generados con MigosAI y clips de referencia de terceros, con sus fuentes indicadas en los pies de vídeo. Para ver todas las funciones y el formulario, visita el <1>generador de vídeos con IA Hotel Lobby</1>.',
    '請到<0>參考影片集</0>了解視覺風格。內容包括 MigosAI 生成的範例及第三方參考片段，每段說明均標示來源。完整功能介紹與生成表單請見 <1>Hotel Lobby AI 影片產生器</1>。'],
  ['Pick a one-time credit pack that fits your workflow. Credits are shared across MigosAI image, video and music tools. No subscription and no watermark added by MigosAI. Review the displayed generation cost before submitting.',
    '작업에 맞는 일회성 크레딧 패키지를 선택하세요. MigosAI의 이미지, 영상, 음악 도구에서 같은 크레딧을 사용합니다. 구독은 없으며 MigosAI는 워터마크를 추가하지 않습니다. 제출 전에 표시된 생성 비용을 확인하세요.',
    '制作に合った買い切りクレジットパックを選んでください。クレジットはMigosAIの画像・動画・音楽ツールで共通です。サブスクリプションはなく、MigosAIによる透かしも追加しません。送信前に表示された生成コストを確認してください。',
    'Choisissez un pack de crédits à achat unique adapté à votre travail. Les crédits sont partagés entre les outils d’image, de vidéo et de musique MigosAI. Sans abonnement ni filigrane ajouté par MigosAI. Vérifiez le coût affiché avant de lancer une génération.',
    'Elige un paquete de créditos de compra única que se ajuste a tu trabajo. Los créditos se comparten entre las herramientas de imagen, vídeo y música de MigosAI. Sin suscripción ni marca de agua añadida por MigosAI. Revisa el coste mostrado antes de generar.',
    '選擇適合創作需求的一次性點數方案。MigosAI 圖片、影片及音樂工具共用同一點數餘額。無訂閱，MigosAI 不會另外加上浮水印。提交前請確認畫面顯示的生成費用。'],
];

export const publicContentMessages = Object.fromEntries((['ko', 'ja', 'fr', 'es', 'zh-TW'] as const).map((locale, index) => [locale, Object.fromEntries(rows.map(row => [row[0], row[index + 1]]))])) as Record<TranslatedLocale, Record<string, string>>;
