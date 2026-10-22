import { OZIL_GOAL_COST } from "@/lib/ozil-goal";

export function ozilBlogText(source: string): string {
  return source.replaceAll("{ozilCredits}", String(OZIL_GOAL_COST)).replaceAll("migosai/LobbyDuo", "MigosAI").replaceAll("LobbyDuo", "MigosAI").replace(/(?<![\w@./:-])migosai(?![\w./:@-])/g, "MigosAI");
}

export const ozilBlogUi = {
  en: {
    read: "Read article", contents: "In this article", faq: "Frequently asked questions", sources: "Sources and product references",
    more: "More Ozil Goal guides", all: "All articles", byline: "By the MigosAI editorial team", published: "Published", language: "Read a related guide in",
    cta: "Make your own Ozil Goal video", ctaText: "One photo. A built-in football template. See the current credit cost before generating.", button: "Open the Ozil Goal generator",
  },
  "pt-BR": {
    read: "Ler artigo", contents: "Neste artigo", faq: "Perguntas frequentes", sources: "Fontes e referências do produto",
    more: "Mais guias do gol do Özil", all: "Todos os artigos", byline: "Pela equipe editorial do MigosAI", published: "Publicado em", language: "Leia um guia relacionado em",
    cta: "Crie seu vídeo do gol do Özil", ctaText: "Uma foto e um modelo de futebol pronto. Confira o custo em créditos antes de gerar.", button: "Abrir o gerador do gol do Özil",
  },
  es: {
    read: "Leer artículo", contents: "En este artículo", faq: "Preguntas frecuentes", sources: "Fuentes y referencias del producto",
    more: "Más guías del gol de Özil", all: "Todos los artículos", byline: "Por el equipo editorial de MigosAI", published: "Publicado el", language: "Lee una guía relacionada en",
    cta: "Crea tu video del gol de Özil", ctaText: "Una foto y una plantilla de fútbol lista para usar. Revisa el coste en créditos antes de generar.", button: "Abrir el generador del gol de Özil",
  },
};
