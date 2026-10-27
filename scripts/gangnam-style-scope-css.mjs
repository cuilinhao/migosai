/** Prefix every source class and animation; colors are mapped to MigosAI tokens. */
import fs from 'node:fs';
import postcss from 'postcss';
const input = process.argv[2];
if (!input) throw new Error('Pass the captured home CSS path.');
const tree = postcss.parse(fs.readFileSync(input, 'utf8'));
const colors = new Set();
tree.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
  if (rule.selector.includes('.groove-login') || rule.selector.includes('.groove-editorial')) { rule.remove(); return; }
  rule.selector = rule.selector.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => name === 'groove-site' ? '.gangnam-page.gangnam-page' : '.gns-' + name);
  if (!rule.selector.includes('.gangnam-page')) rule.selector = rule.selectors.map(s => '.gangnam-page.gangnam-page ' + s).join(',');
  // Source section spacing must not restyle embedded MigosAI billing widgets.
  rule.selectors = rule.selectors.map(s => s === '.gangnam-page.gangnam-page section' ? '.gangnam-page.gangnam-page .gns-content > section' : s);
});
tree.walkDecls(decl => {
  for (const match of decl.value.matchAll(/#[a-fA-F\d]{3,8}\b/g)) colors.add(match[0]);
  decl.value = decl.value.replace(/#[a-fA-F\d]{3,8}\b/g, hex => {
    const h = hex.slice(1); const full = h.length <= 4 ? [...h].map(c => c+c).join('') : h;
    const r=parseInt(full.slice(0,2),16),g=parseInt(full.slice(2,4),16),b=parseInt(full.slice(4,6),16);
    const alpha=full.length===8?parseInt(full.slice(6),16)/255:1;
    const light=(r+g+b)/3;
    let token = light>225 ? '--card' : light>185 ? '--border' : light<75 ? '--foreground' : '--muted';
    if (g>r+10 && g>b+20) token='--primary';
    if (r>g*1.25 && r>b*1.1) token='--destructive';
    return alpha < 1 ? `color-mix(in srgb,var(${token}) ${Math.round(alpha*100)}%,transparent)` : `var(${token})`;
  });
  if (/^(animation|animation-name)$/.test(decl.prop)) decl.value=decl.value.replace(/groove-spin/g,'gangnam-spin');
});
tree.walkAtRules('keyframes',rule => {if(rule.params==='groove-spin')rule.params='gangnam-spin';});
fs.writeFileSync('components/gangnam-style/reference.css','/* Imported from gangnamstyle.io/home-20bEAjAE.css; scoped and mapped to site theme. */\n'+tree.toString());
console.log('Scoped source stylesheet, mapped',colors.size,'source colors.');
