export const routeQuestions = [
  { id: 'app', text: 'Is CapCut already on your phone and signed in?', a: 'Yes, I use it', b: 'No, or not sure' },
  { id: 'opens', text: 'When you tap an Ozil goal template link, does it open in CapCut?', a: 'Yes, it opens', b: 'No, or I have not tried' },
  { id: 'budget', text: 'Are you willing to use credits for the clip?', a: 'Only if it is free', b: 'Yes, if it saves hassle' },
  { id: 'effort', text: 'How do you feel about picking photos and exporting in an editor?', a: 'Happy to do it', b: 'I would rather not' },
] as const;
export type RouteAnswers = Partial<Record<(typeof routeQuestions)[number]['id'], 'a' | 'b'>>;
// Same decision order as y(t) in ozil-goal-capcut-template-CjsIgeh5.js.
export function getRouteRecommendation(answers: RouteAnswers, cost: number) {
  if (!routeQuestions.every(question => answers[question.id])) return null;
  const app = answers.app === 'a', opens = answers.opens === 'a', free = answers.budget === 'a', effort = answers.effort === 'a';
  if (free) return { label: 'CapCut', title: 'Go with the CapCut template', text: app ? 'You want it to cost nothing and you already have the app. Search for an Ozil goal template in CapCut, add your photo and export. If the link will not open, try searching inside the app instead. Check current template pricing in CapCut.' : 'You want it to cost nothing, so try the CapCut route: install the app, sign in, then search for an Ozil goal template and check its current pricing. Expect a few minutes of setup the first time.', cta: 'capcut' as const };
  if (app && opens && effort) return { label: 'CapCut first', title: 'Try CapCut first, keep us as the backup', text: 'Everything is already in place for you: the app, a working template and the patience to edit. Try it if the template is available for free. If the result does not look like you, or you want the full 15-second clip from one photo, come back here.', cta: 'both' as const };
  return { label: 'Ozil Goal', title: 'This site is the faster route for you', text: opens ? `You would rather not set up an app or edit. Here you add one photo in any browser, press one button and download a 15-second vertical MP4 when generation finishes. Each video uses ${cost} shared MigosAI credits.` : `The template link is the usual sticking point: if it does not open where you are, there is not much you can do about it. Here you add one photo in a browser and request a 15-second vertical clip using ${cost} shared MigosAI credits. Generation time varies.`, cta: 'site' as const };
}
