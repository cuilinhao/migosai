/** Preserve deployed Flying Car AI CSS while isolating its selectors and registered properties. */
import fs from 'node:fs';
import postcss from 'postcss';
const source = process.argv[2] || '/tmp/flyingcar-recon/assets/index-BECjiMG-.css';
const original = fs.readFileSync(source, 'utf8');
const host = fs.readFileSync('app/globals.css', 'utf8');
const classNames = css => {
  const found = new Set();
  postcss.parse(css).walkRules(rule => {
    for (const match of rule.selector.matchAll(/(?<![\w\\-])\.([A-Za-z_][\w-]*)(?![\w\\-])/g)) found.add(match[1]);
  });
  return found;
};
const hostNames = classNames(host);
const map = Object.fromEntries([...classNames(original)].filter(name => hostNames.has(name)).sort().map(name => [name, 'fc-' + name]));
fs.writeFileSync('content/flyingcar-class-map.json', JSON.stringify(map, null, 2) + '\n');
let css = original.replaceAll('--tw-', '--fc-tw-').replaceAll('--shimmer-', '--fc-shimmer-').replaceAll('--scroll-fade-', '--fc-scroll-fade-');
css = css.replace(/\bAnton\b/g, '"Flyingcar Anton"').replace(/\bArchivo\b/g, '"Flyingcar Archivo"');
css = css.replaceAll('/assets/fonts/', '/flyingcar/fonts/');
const root = postcss.parse(css);
const names = new Map();
root.walkAtRules('keyframes', rule => { const name = 'flyingcar-' + rule.params; names.set(rule.params, name); rule.params = name; });
root.walkDecls(decl => {
  if (decl.prop === 'animation' || decl.prop === 'animation-name') {
    for (const [from, to] of names) decl.value = decl.value.replace(new RegExp('(?<![\\w-])' + from + '(?![\\w-])', 'g'), to);
  }
});
root.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
  rule.selectors = rule.selectors.map(selector => {
    let updated = selector;
    for (const [from, to] of Object.entries(map)) updated = updated.replace(new RegExp('(?<![\\w\\\\-])\\.' + from + '(?![\\w\\\\-])', 'g'), '.' + to);
    const trimmed = updated.trim();
    if (/^(?::root|:host|html|body|\.dark)(?=$|[\s:.[])/.test(trimmed)) {
      return trimmed.replace(/^(?::root|:host|html|body)/, '.flyingcar-page').replace(/^\.dark/, '.flyingcar-page.dark');
    }
    return '.flyingcar-page ' + trimmed;
  });
});
root.walkAtRules('layer', rule => { if (rule.nodes) rule.replaceWith(...rule.nodes); else rule.remove(); });
const nativeDetails = `
/* Native FAQ semantics preserve keyboard interaction without executing source components. */
.flyingcar-page details.faq-row > summary { list-style: none; }
.flyingcar-page details.faq-row > summary::-webkit-details-marker { display: none; }
.flyingcar-page details.faq-row[open] .faq-plus { transform: rotate(45deg); }
.flyingcar-page .article-faq { margin-top: 48px; }
.flyingcar-page .article-faq .faq-trigger { font-size: 15px; }
.flyingcar-page video { background: #07080c; }
`;
const nativeScoped = Object.entries(map).reduce((s,[from,to]) => s.replace(new RegExp('\\.'+from+'(?![\\w-])','g'),'.'+to),nativeDetails);
fs.writeFileSync('components/flyingcar/reference.css', '/* Scoped from flyingcar-ai.app index-BECjiMG-.css. Rebuild with scripts/flyingcar-scope-css.mjs. */\n' + root.toString() + '\n' + nativeScoped);
console.log('Scoped CSS; class collisions:', map, '; fonts: Flyingcar Anton, Flyingcar Archivo');
