/** Scope deployed reference CSS; source CSS is data, never executed JavaScript. */
import fs from 'node:fs';
import postcss from 'postcss';
const source = process.argv[2] || '/tmp/ozil-source/styles-B2w4TpLD.css';
let css = fs.readFileSync(source, 'utf8').replaceAll('--tw-', '--ogtw-').replaceAll('--shimmer-', '--ogref-shimmer-').replaceAll('--scroll-fade-', '--ogref-scroll-fade-');
css = css.replaceAll('Instrument Sans', 'Ozil Instrument Sans').replaceAll('Barlow Condensed', 'Ozil Barlow Condensed');
css = css.replaceAll('/assets/instrument-sans-latin-wght-BbzFLZTg.woff2', '/ozil-goal/fonts/instrument-sans.woff2').replaceAll('/assets/barlow-condensed-800i-latin-BaEn-VSx.woff2', '/ozil-goal/fonts/barlow-condensed-800i.woff2');
const root = postcss.parse(css);
const names = new Map();
root.walkAtRules('keyframes', node => { names.set(node.params, 'ozil-ref-' + node.params); node.params = names.get(node.params); });
root.walkDecls(decl => {
  if (decl.prop === 'animation' || decl.prop === 'animation-name') {
    for (const [from, to] of names) decl.value = decl.value.replace(new RegExp('(?<![\\w-])' + from + '(?![\\w-])', 'g'), to);
  }
});
root.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
  rule.selectors = rule.selectors.map(selector => {
    const trimmed = selector.trim();
    if (/^(?::root|:host|html|body|\.dark)(?=$|[\s:.[])/.test(trimmed)) {
      return trimmed.replace(/^(?::root|:host|html|body)/, '.ozil-page').replace(/^\.dark/, '.ozil-page.dark');
    }
    return '.ozil-page ' + trimmed;
  });
});
root.walkAtRules('layer', node => { if (node.nodes) node.replaceWith(...node.nodes); else node.remove(); });
fs.writeFileSync('components/ozil-goal/reference.css', '/* Scoped from ozilgoal.com styles-B2w4TpLD.css. Rebuild: node scripts/ozil-scope-css.mjs */\n'+root.toString()+'\n');
