import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';

// Read-only HTTP verification. No browser automation, generation or deployment.
// node scripts/check-gangnam-seo.mjs --baseUrl http://127.0.0.1:8787 --phase local
// Optional --locales en,zh-TW or --paths /path/one,/path/two limits page checks.
// Sitemap still checks all 72 canonical URLs, and all six unknown slugs are checked.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(root, '.local-evidence/migos-seo-sync-20261030');
await mkdir(evidenceDir, { recursive: true });
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (!['--baseUrl', '--base-url', '--phase', '--locales', '--paths'].includes(args[i]) || !args[i + 1]) throw new Error(`Unknown or incomplete option: ${args[i]}`);
  options[args[i].slice(2)] = args[++i];
}
const baseUrl = (options.baseUrl ?? options['base-url'] ?? 'http://127.0.0.1:3012').replace(/\/$/, '');
const base = new URL(baseUrl);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('baseUrl must be an HTTP(S) origin without credentials, path, query or fragment.');
const phase = options.phase ?? 'local';
if (!/^[a-zA-Z0-9_-]+$/.test(phase)) throw new Error('phase must contain only letters, numbers, underscores or hyphens.');
const run = promisify(execFile);
const normalized = value => String(value ?? '').replace(/\s+/g, ' ').trim();

// Read the actual root title template rather than guessing its product suffix.
const layout = ts.createSourceFile('layout.tsx', await readFile(path.join(root, 'app/layout.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let titleTemplate;
function inspectTemplate(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(layout) === 'baseMetadata' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
    const title = node.initializer.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(layout) === 'title');
    const template = title && ts.isObjectLiteralExpression(title.initializer) && title.initializer.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(layout) === 'template');
    if (template && ts.isStringLiteral(template.initializer)) titleTemplate = template.initializer.text;
  }
  ts.forEachChild(node, inspectTemplate);
}
inspectTemplate(layout);
if (!titleTemplate?.includes('%s')) throw new Error('Could not read the actual root metadata title template.');

const exportSource = `
import source from './content/gangnam-style-page.json';
import { SITE_URL } from './content/public-pages';
import { locales, localizeHref } from './lib/i18n/routing';
import { getGangnamTranslator } from './lib/i18n/gangnam-style';
import { getGangnamBlogTranslator, translateGangnamPost } from './lib/i18n/gangnam-blog';
import { gangnamBlogMetadata, gangnamBlogText } from './components/gangnam-style/blog-metadata';
import { gangnamBlogPosts, GANGNAM_BLOG_PATH, GANGNAM_GENERATOR_PATH } from './content/gangnam-style-blog';
import { gangnamStylePrompt } from './lib/prompts/gangnam-style';
const normalize = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
const plain = value => gangnamBlogText(value).replace(/\\*\\*(.+?)\\*\\*/g, '$1').replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g, '$1');
const find = (node, tag) => typeof node === 'string' || !node.children ? [] : [...(node.tag === tag ? [node] : []), ...node.children.flatMap(child => find(child, tag))];
const strings = node => typeof node === 'string' ? [node] : (node.children ?? []).flatMap(strings);
const text = (node, t) => typeof node === 'string' ? t(node) : node.tag === 'br' ? ' ' : (node.children ?? []).map(child => text(child, t)).join('');
const alternates = p => Object.fromEntries([...locales.map(locale => [locale, SITE_URL + localizeHref(p, locale)]), ['x-default', SITE_URL + p]]);
const pages = [];
for (const locale of locales) {
  const ui = getGangnamTranslator(locale), blog = getGangnamBlogTranslator(locale);
  const posts = gangnamBlogPosts.map(post => translateGangnamPost(post, locale));
  const generatorPath = localizeHref(GANGNAM_GENERATOR_PATH, locale);
  const faq = find(source.content, 'details').map(detail => ({
    question: normalize(find(detail, 'summary').map(node => text(node, ui)).join(' ')),
    answer: normalize(detail.children.filter(node => typeof node === 'string' || node.tag !== 'summary').map(node => text(node, ui)).join('')),
  }));
  pages.push({ kind: 'generator', locale, path: generatorPath, canonical: SITE_URL + generatorPath,
    title: ${JSON.stringify(titleTemplate)}.replace('%s', ui(source.title)), description: ui(source.description),
    h1: normalize(text(find(source.content, 'h1')[0], ui)), bodyClass: 'gangnam-page',
    bodyTexts: strings(source.content).map(value => normalize(ui(value))).filter(value => value.length > 1),
    alternates: alternates(GANGNAM_GENERATOR_PATH), faq, prompts: [] });
  const index = gangnamBlogMetadata(undefined, locale), indexPath = localizeHref(GANGNAM_BLOG_PATH, locale);
  pages.push({ kind: 'index', locale, path: indexPath, canonical: SITE_URL + indexPath,
    title: index.title.absolute, description: index.description,
    h1: blog('Gangnam Style AI Video: 10 Practical Guides'), bodyClass: 'gangnam-blog',
    bodyTexts: posts.flatMap(post => [post.title, plain(post.excerpt)]),
    alternates: alternates(GANGNAM_BLOG_PATH), headlines: posts.map(post => post.title), prompts: [] });
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i], original = gangnamBlogPosts[i], metadata = gangnamBlogMetadata(original, locale);
    const blocks = post.sections.flatMap(section => section.blocks);
    const bodyTexts = [post.title, plain(post.intro), ...post.sections.map(section => section.title), ...blocks.flatMap(block => {
      if (block.type === 'code') return [];
      if ('text' in block) return [plain(block.text)];
      if ('items' in block) return block.items.map(plain);
      return [plain(block.caption), ...block.headings.map(plain), ...block.rows.flat().map(plain)];
    }), ...post.faqs.flatMap(faq => [plain(faq.question), plain(faq.answer)]), ...post.sources.map(item => item.label)];
    const p = localizeHref(post.path, locale);
    pages.push({ kind: 'article', locale, path: p, canonical: SITE_URL + p,
      title: metadata.title.absolute, description: metadata.description, h1: post.title,
      headline: post.title, bodyClass: 'gangnam-blog', bodyTexts,
      alternates: alternates(post.path), faq: post.faqs.map(faq => ({ question: plain(faq.question), answer: plain(faq.answer) })),
      prompts: original.sections.flatMap(section => section.blocks).filter(block => block.type === 'code').map(block => block.text) });
  }
}
export default { siteUrl: SITE_URL, locales, pages, productionPrompts: ['friends', 'selfie', 'pets'].map(mode => gangnamStylePrompt(mode)) };
`;
const bundled = await build({ stdin: { contents: exportSource, resolveDir: root, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
const expectations = (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)).default;
if (expectations.pages.length !== 72) throw new Error(`Expected 72 pages, received ${expectations.pages.length}.`);
const selectedLocales = options.locales ? options.locales.split(',') : expectations.locales;
if (selectedLocales.some(locale => !expectations.locales.includes(locale))) throw new Error('Unknown locale filter.');
const requestedPaths = options.paths ? options.paths.split(',').map(value => value.trim()) : null;
if (requestedPaths && (new Set(requestedPaths).size !== requestedPaths.length || requestedPaths.some(value => !expectations.pages.some(page => page.path === value)))) throw new Error('Every --paths entry must be a unique path in the actual 72-page matrix.');
await writeFile(path.join(evidenceDir, `localized-expectations-${phase}.json`), JSON.stringify(expectations, null, 2));

const htmlParser = String.raw`import sys,json
from html.parser import HTMLParser
class P(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.stack=[];self.captures=[];self.data={'title':[],'description':[],'h1':[],'htmlLang':[],'bodies':[],'canonical':[],'alternates':[],'jsonld':[],'jsonldErrors':[],'codes':[],'ogUrl':[],'robots':[],'links':[],'tableCount':0}
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);depth=len(self.stack)
  if tag=='html':self.data['htmlLang'].append(a.get('lang',''))
  if tag=='a' and a.get('href'):self.data['links'].append(a['href'])
  if tag=='table':self.data['tableCount']+=1
  if tag=='meta' and a.get('property')=='og:url':self.data['ogUrl'].append(a.get('content',''))
  if tag=='meta' and a.get('name')=='robots':self.data['robots'].append(a.get('content',''))
  if tag=='meta' and a.get('name','').lower()=='description':self.data['description'].append(a.get('content',''))
  if tag=='link' and a.get('rel','').lower()=='canonical':self.data['canonical'].append(a.get('href',''))
  if tag=='link' and a.get('rel','').lower()=='alternate' and 'hreflang' in a:self.data['alternates'].append({'language':a['hreflang'],'href':a.get('href','')})
  kind=tag if tag in ('title','h1','code') else 'jsonld' if tag=='script' and a.get('type')=='application/ld+json' else None
  classes=a.get('class','').split()
  if 'gangnam-page' in classes or 'gangnam-blog' in classes:kind='body'
  if kind:self.captures.append({'kind':kind,'tag':tag,'depth':depth,'parts':[],'lang':a.get('lang',''),'classes':classes})
  if tag=='br':
   for cap in self.captures:
    if cap['kind'] in ('body','h1'):cap['parts'].append(' ')
  if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):self.stack.append(tag)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
 def handle_data(self,text):
  hidden=any(tag in ('script','style','template') for tag in self.stack)
  for cap in self.captures:
   if cap['kind']=='jsonld' or not hidden:cap['parts'].append(text)
 def handle_endtag(self,tag):
  if tag not in self.stack:return
  idx=len(self.stack)-1-self.stack[::-1].index(tag)
  for cap in self.captures[:]:
   if cap['depth']>=idx:
    text=''.join(cap['parts']);kind=cap['kind']
    if kind=='body':self.data['bodies'].append({'lang':cap['lang'],'classes':cap['classes'],'text':text})
    elif kind=='jsonld':
     try:self.data['jsonld'].append(json.loads(text))
     except Exception as e:self.data['jsonldErrors'].append(str(e))
    else:self.data['codes' if kind=='code' else kind].append(text)
    self.captures.remove(cap)
  self.stack=self.stack[:idx]
  if tag in ('p','div','section','article','li','th','td','h1','h2','h3','summary'):
   for cap in self.captures:
    if cap['kind']=='body':cap['parts'].append(' ')
p=P();p.feed(sys.stdin.read());p.close();print(json.dumps(p.data,ensure_ascii=False))`;
async function fetchPage(pathname) {
  const url = new URL(pathname, baseUrl).href;
  const { stdout } = await run('curl', ['--silent', '--show-error', '--retry', '2', '--retry-all-errors', '--connect-timeout', '10', '--max-time', '45', '--write-out', '\n%{http_code}', url], { maxBuffer: 16 * 1024 * 1024, timeout: 150000 });
  const split = stdout.lastIndexOf('\n');
  return { url, status: Number(stdout.slice(split + 1)), body: stdout.slice(0, split) };
}
const flattenSchema = documents => documents.flatMap(document => Array.isArray(document) ? flattenSchema(document) : document?.['@graph'] ? [document, ...flattenSchema(document['@graph'])] : [document]);
const checks = [];
async function verifyPage(expected) {
  const result = { path: expected.path, locale: expected.locale, kind: expected.kind, passed: false, assertions: [] };
  const check = (name, passed, details) => result.assertions.push({ name, passed: Boolean(passed), ...(!passed && details ? { details } : {}) });
  try {
    const response = await fetchPage(expected.path);
    result.url = response.url; result.status = response.status;
    check('http_200', response.status === 200, response.status);
    const actual = JSON.parse(execFileSync('python3', ['-c', htmlParser], { input: response.body, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 15000 }));
    for (const field of ['title', 'description', 'h1']) check(field, actual[field].length === 1 && normalized(actual[field][0]) === normalized(expected[field]), { expected: expected[field], actual: actual[field] });
    check('document_locale', actual.htmlLang.length === 1 && actual.htmlLang[0] === expected.locale, actual.htmlLang);
    const body = actual.bodies.find(item => item.classes.includes(expected.bodyClass));
    check('body_locale', body?.lang === expected.locale, body?.lang ?? 'missing content container');
    const bodyText = normalized(body?.text);
    const missingText = expected.bodyTexts.filter(text => normalized(text) && !bodyText.includes(normalized(text)));
    check('translated_body_content', missingText.length === 0, { missingCount: missingText.length, examples: missingText.slice(0, 5) });
    check('no_price_placeholders', !/\{(?:standardCredits|hdCredits|credits)\}/.test(bodyText));
    check('canonical', actual.canonical.length === 1 && actual.canonical[0] === expected.canonical, { expected: expected.canonical, actual: actual.canonical });
    const foundAlternates = Object.fromEntries(actual.alternates.map(item => [item.language, item.href]));
    check('seven_hreflang', actual.alternates.length === 7 && Object.keys(foundAlternates).length === 7 && Object.entries(expected.alternates).every(([locale, href]) => foundAlternates[locale] === href), { expected: expected.alternates, actual: actual.alternates });
    check('og_url', actual.ogUrl.length === 1 && actual.ogUrl[0] === expected.canonical, actual.ogUrl);
    check('indexable', !actual.robots.some(value => /noindex/i.test(value)));
    const schemas = flattenSchema(actual.jsonld);
    const organization = schemas.filter(item => item?.['@type'] === 'Organization' && item['@id'] === expectations.siteUrl + '/#org');
    const website = schemas.filter(item => item?.['@type'] === 'WebSite' && item['@id'] === expectations.siteUrl + '/#website');
    check('migos_entities', organization.length === 1 && organization[0].name === 'MigosAI' && website.length === 1 && website[0].publisher?.['@id'] === organization[0]?.['@id']);
    check('no_standalone_brand', !JSON.stringify(actual.jsonld).includes('gangnamstyle-ai-video.com'));
    if (expected.kind === 'generator') {
      check('semantic_spec_table', actual.tableCount >= 1);
      const guidePaths = expectations.pages.filter(page => page.kind === 'article' && page.locale === expected.locale).map(page => page.path);
      check('all_ten_guide_links', guidePaths.length === 10 && guidePaths.every(path => actual.links.includes(path)));
      check('studio_retained', response.body.includes('id="studio"') && response.body.includes('type="file"'));
      const application = schemas.find(item => item?.['@type'] === 'SoftwareApplication');
      check('generator_entity', application?.url === expected.canonical);
    }
    check('jsonld_valid', actual.jsonldErrors.length === 0 && actual.jsonld.length > 0, actual.jsonldErrors);
    if (expected.kind === 'index') {
      const blog = schemas.find(item => item?.['@type'] === 'Blog' && item.url === expected.canonical);
      check('jsonld_blog_locale', blog?.inLanguage === expected.locale);
      check('jsonld_ten_articles', blog?.blogPost?.length === 10 && expected.headlines.every((title, i) => blog.blogPost[i]?.headline === title && blog.blogPost[i]?.inLanguage === expected.locale));
    } else {
      const faq = schemas.find(item => item?.['@type'] === 'FAQPage' && (item.url === expected.canonical || item['@id'] === `${expected.canonical}#faq`));
      check('jsonld_faq_locale', faq?.inLanguage === expected.locale);
      const faqMatches = faq?.mainEntity?.length === expected.faq.length && expected.faq.every((item, i) => normalized(faq.mainEntity[i]?.name) === normalized(item.question) && normalized(faq.mainEntity[i]?.acceptedAnswer?.text) === normalized(item.answer));
      check('jsonld_faq_content', faqMatches, { expectedCount: expected.faq.length, actualCount: faq?.mainEntity?.length });
      if (expected.kind === 'article') {
        const article = schemas.find(item => item?.['@type'] === 'BlogPosting' && item.url === expected.canonical);
        check('jsonld_article_locale', article?.inLanguage === expected.locale);
        check('jsonld_article_headline', article?.headline === expected.headline, article?.headline);
        check('article_dates_preserved', article?.datePublished === '2026-10-28' && article?.dateModified === '2026-10-28');
        check('publisher_entity', article?.publisher?.['@id'] === expectations.siteUrl + '/#org');
      }
    }
    check('prompt_blocks_preserved', actual.codes.length === expected.prompts.length && expected.prompts.every((prompt, i) => actual.codes[i] === prompt), { expectedCount: expected.prompts.length, actualCount: actual.codes.length });
    if (expected.prompts.length) check('production_prompts_unchanged', JSON.stringify(expected.prompts) === JSON.stringify(expectations.productionPrompts));
    result.passed = result.assertions.every(item => item.passed);
  } catch (error) { result.error = String(error); }
  return result;
}
const matrix = expectations.pages.filter(page => selectedLocales.includes(page.locale) && (!requestedPaths || requestedPaths.includes(page.path)));
if (!matrix.length || (requestedPaths && matrix.length !== requestedPaths.length)) throw new Error('The locale/path filters excluded a requested page.');
for (let i = 0; i < matrix.length; i += 3) {
  checks.push(...await Promise.all(matrix.slice(i, i + 3).map(verifyPage)));
  console.log(`Pages ${checks.length}/${matrix.length}: ${checks.filter(item => item.passed).length} passed`);
}

const sitemap = { passed: false, expectedCount: 759 };
try {
  const response = await fetchPage('/sitemap.xml'); sitemap.status = response.status;
  const parser = String.raw`import sys,json,xml.etree.ElementTree as ET
root=ET.fromstring(sys.stdin.read());ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
print(json.dumps({'root':root.tag,'urls':[node.text for node in root.findall('s:url/s:loc',ns)],'entries':[{'url':node.find('s:loc',ns).text,'lastmod':node.findtext('s:lastmod',default='',namespaces=ns),'languages':{link.get('hreflang'):link.get('href') for link in node.findall('{http://www.w3.org/1999/xhtml}link')}} for node in root.findall('s:url',ns)]}))`;
  const parsed = JSON.parse(execFileSync('python3', ['-c', parser], { input: response.body, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 15000 }));
  sitemap.actualCount = parsed.urls.length;
  sitemap.duplicates = parsed.urls.filter((url, index, values) => values.indexOf(url) !== index);
  sitemap.missingPages = expectations.pages.map(page => page.canonical).filter(url => !parsed.urls.includes(url));
  sitemap.invalidTargetEntries = expectations.pages.filter(page => { const entry = parsed.entries.find(entry => entry.url === page.canonical); return !entry || !entry.lastmod.startsWith(page.kind === 'article' ? '2026-10-28' : '2026-10-30') || JSON.stringify(Object.fromEntries(Object.entries(entry.languages).sort())) !== JSON.stringify(Object.fromEntries(Object.entries(page.alternates).sort())); }).map(page => page.path);
  sitemap.passed = sitemap.invalidTargetEntries.length === 0 && response.status === 200 && parsed.root === '{http://www.sitemaps.org/schemas/sitemap/0.9}urlset' && parsed.urls.length === 759 && sitemap.duplicates.length === 0 && sitemap.missingPages.length === 0;
} catch (error) { sitemap.error = String(error); }
const unknownSlugs = [];
for (let i = 0; i < expectations.locales.length; i += 3) {
  unknownSlugs.push(...await Promise.all(expectations.locales.slice(i, i + 3).map(async locale => {
    const pathname = `${locale === 'en' ? '' : '/' + locale}/gangnam-style-ai-video-generator/blog/__verification_unknown_slug__`;
    try { const result = await fetchPage(pathname); return { locale, path: pathname, status: result.status, passed: result.status === 404 && /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(result.body) }; }
    catch (error) { return { locale, path: pathname, passed: false, error: String(error) }; }
  })));
}
const discovery = { passed: false };
try {
  const [robots, llms] = await Promise.all([fetchPage('/robots.txt'), fetchPage('/llms.txt')]);
  discovery.walletDisallows = expectations.locales.every(locale => robots.body.includes('Disallow: ' + (locale === 'en' ? '' : '/' + locale) + '/guest-wallet'));
  discovery.allGuideLinks = expectations.pages.filter(page => page.kind === 'article' && page.locale === 'en').every(page => llms.body.includes(page.canonical));
  discovery.correctGangnamAudio = !/Gangnam[^\n]+silent MP4/i.test(llms.body) && /soundtrack/i.test(llms.body);
  discovery.passed = robots.status === 200 && llms.status === 200 && discovery.walletDisallows && discovery.allGuideLinks && discovery.correctGangnamAudio;
} catch (error) { discovery.error = String(error); }
const report = { checkedAt: new Date().toISOString(), phase, baseUrl, canonicalOrigin: expectations.siteUrl, concurrency: 3, curlTimeoutSeconds: 45, htmlParserTimeoutSeconds: 15,
  scope: { matrixPages: 72, checkedPages: matrix.length, locales: [...new Set(matrix.map(page => page.locale))], paths: requestedPaths, fullMatrix: matrix.length === 72 },
  passed: checks.every(item => item.passed) && sitemap.passed && unknownSlugs.every(item => item.passed) && discovery.passed, checks, sitemap, unknownSlugs, discovery };
const output = path.join(evidenceDir, `localized-${phase}.json`);
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ phase, passed: report.passed, pagesPassed: checks.filter(item => item.passed).length, pagesTotal: matrix.length, sitemap, unknownSlugs, discovery, output,
  failures: checks.filter(item => !item.passed).map(item => ({ path: item.path, error: item.error, assertions: item.assertions.filter(assertion => !assertion.passed) })) }, null, 2));
if (!report.passed) process.exitCode = 1;
