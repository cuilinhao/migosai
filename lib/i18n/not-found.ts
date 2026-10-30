import type { Locale } from './routing';

type NotFoundMessages = {
  title: string;
  description: string;
  home: string;
  blog: string;
};

export const notFoundMessages: Record<Locale, NotFoundMessages> = {
  en: {
    title: 'Page not found',
    description: 'The page you requested could not be found. It may have moved, or the address may be incorrect. Return to the generator or browse the blog to continue.',
    home: 'Back to home',
    blog: 'Explore the blog',
  },
  ko: {
    title: '페이지를 찾을 수 없습니다',
    description: '요청하신 페이지를 찾을 수 없습니다. 페이지가 이동되었거나 주소가 잘못되었을 수 있습니다. 생성기로 돌아가거나 블로그에서 가이드를 확인해 주세요.',
    home: '홈으로 돌아가기',
    blog: '블로그 둘러보기',
  },
  ja: {
    title: 'ページが見つかりません',
    description: 'お探しのページが見つかりません。ページが移動したか、アドレスが間違っている可能性があります。生成ツールに戻るか、ブログのガイドをご覧ください。',
    home: 'ホームに戻る',
    blog: 'ブログを見る',
  },
  fr: {
    title: 'Page introuvable',
    description: 'La page demandée est introuvable. Elle a peut-être été déplacée ou son adresse est incorrecte. Revenez au générateur ou consultez les guides du blog pour continuer.',
    home: 'Retour à l’accueil',
    blog: 'Explorer le blog',
  },
  es: {
    title: 'Página no encontrada',
    description: 'No se ha encontrado la página que buscas. Puede que se haya movido o que la dirección sea incorrecta. Vuelve al generador o consulta las guías del blog para continuar.',
    home: 'Volver al inicio',
    blog: 'Explorar el blog',
  },
  'zh-TW': {
    title: '找不到此頁面',
    description: '找不到你要瀏覽的頁面。頁面可能已移動，或網址輸入有誤。你可以返回首頁使用生成工具，或前往部落格閱讀教學。',
    home: '返回首頁',
    blog: '瀏覽部落格',
  },
};
