"""Import Flying Car AI public HTML and literal FAQ data without executing source JS.
Usage: python3 scripts/flyingcar-import-content.py /tmp/flyingcar-recon
The original legal documents are evidence only; displayed links use migosai policies.
"""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1])
BASE='/flying-car-ai-video-generator'
CLASS_MAP=json.loads((ROOT/'content/flyingcar-class-map.json').read_text())
GUIDE='how-to-make-a-tesla-roadster-flying-car-video'
TREND='tesla-flying-car-ai-video-trend'
SLUGS=['home',GUIDE,TREND,'privacy','terms']
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class Parser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root={'tag':'root','attrs':{},'children':[]};self.stack=[self.root]
 def handle_starttag(self,tag,attrs):
  n={'tag':tag,'attrs':dict(attrs),'children':[]};self.stack[-1]['children'].append(n)
  if tag not in VOID:self.stack.append(n)
 def handle_startendtag(self,tag,attrs):
  self.handle_starttag(tag,attrs)
  if tag not in VOID:self.handle_endtag(tag)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i]['tag']==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):self.stack[-1]['children'].append(data)
def walk(n):
 if isinstance(n,dict) and 'tag' in n:
  yield n
  for c in n['children']:yield from walk(c)
def txt(n):return n if isinstance(n,str) else ''.join(txt(c) for c in n.get('children',[]))
def node(tag,children,attrs=None):return {'tag':tag,'attrs':attrs or {},'children':children}
def write(name,value):(ROOT/'content'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

# Known literal arrays only. Backticks are decoded as text, never evaluated.
bundle=SOURCE/'assets/index-nlP9j1ZZ.js'
js=bundle.read_text()
def pairs_between(start,end):
 fragment=js.split(start,1)[1].split(end,1)[0]
 pairs=re.findall(r'\[\s*`((?:\\.|[^`])*)`\s*,\s*`((?:\\.|[^`])*)`\s*,?\s*\]',fragment)
 return [[a.replace('\\`','`'),b.replace('\\`','`')] for a,b in pairs]
home_faq=pairs_between('var ki = [','Ai =')
guide_faq=pairs_between('Ae = [','je =')
assert len(home_faq)==17 and len(guide_faq)==6,(len(home_faq),len(guide_faq))
BILLING='Use your shared migosai credits. The generator shows the credit cost for your selected length before you start. Sign in with your migosai account, and check progress and finished clips in My Videos. Failed generations return credits through the existing migosai workflow.'
exact={
 'Create my video · from $4.99':'Create my video',
 'Create your own Tesla Roadster flying car AI video from text or an optional photo. No login required. No subscription. Silent, watermark-free clips.':'Create your own Tesla Roadster flying car AI video from text or an optional photo. Use shared migosai credits for silent, watermark-free vertical clips.',
 'No login required. No subscription. A photo is optional.':'Use your migosai account and shared credits. A photo is optional.',
 'NO SUBSCRIPTION':'SHARED MIGOSAI CREDITS',
 'Describe the scene in your own words, choose a length, and you can change the prompt for every credit in your pack.':'Describe the scene in your own words, choose a length, and use your shared migosai credits for each new idea.',
 'Pick a pack and pay once':'Use your migosai credits',
 'No subscription. No account. Failed renders return the credit automatically.':'Sign in with your migosai account. Failed generations return credits automatically.',
 "A private result link and an email when it's ready":'Progress, results and downloads in My Videos',
 'A new prompt for every credit in your pack':'Write a new prompt for each generation',
 'Unused credits never expire':'Shared credits follow the migosai pricing terms',
 'PAY ONCE, GET THE CLIP':'CREATE, THEN CHECK MY VIDEOS',
 'Stripe Checkout collects your email. We render the video, email your private link, and keep any unused credits waiting for your next idea.':'Sign in and use your shared migosai credits. Check progress and download your finished clip from My Videos.',
 'No login, no subscription, no editing app. Three steps from an idea to a downloadable MP4.':'Use your existing migosai account and credits. Three steps from an idea to a downloadable MP4.',
 'PRIVATE LINK':'MY VIDEOS',
 'A prompt-led AI video studio for flying-car scenes. Your words, an optional photo, and a 5–30 second clip delivered through a private link.':'A prompt-led AI video studio for flying-car scenes. Your words, an optional photo, and a 5–30 second clip in your migosai My Videos history.',
 'support@unforgettablecarai.video':'Contact migosai support',
 "Yes, as long as it's your photo or you have permission to use it. One reference image is supported (JPEG, PNG, WebP or HEIC, up to 10 MB). The render won't always reproduce every detail, but the image helps keep the subject consistent.":"Yes, as long as it's your photo or you have permission to use it. One reference image is supported (JPEG, PNG or WebP, up to 10 MB). The render won't always reproduce every detail, but the image helps keep the subject consistent.",
 'length-based pricing':'migosai credit pricing',
 'the duration-based pricing':'migosai credit pricing',
 ' before choosing a pack.':' before generating.',
 ' before selecting a pack.':' before generating.',
 "It's a no-login web app that turns a written scene — and, if you want, one photo — into a short cinematic video of a flying car. Describe the moment you want to see, choose a pack, and we render it for you.":"It turns a written scene — and, if you want, one photo — into a short cinematic video of a flying car. Describe the moment, sign in with your migosai account and use your shared credits to generate it.",
 'Three steps: describe your scene in your own words, optionally add a reference photo, then pay once at Stripe Checkout. The finished MP4 is delivered through a private result link and emailed to you.':'Three steps: describe your scene in your own words, optionally add a reference photo, then sign in and use your migosai credits. The finished MP4 is available to watch and download in My Videos.',
 'A 9:16 vertical MP4 with the length you chose in the creator (5 to 30 seconds) — silent, watermark-free and ready to post. You can watch it and download it from your private result page, and the link also arrives by email.':'A 9:16 vertical MP4 with the length you chose in the creator (5 to 30 seconds) — silent, watermark-free and ready to review. Watch and download it from your migosai My Videos history.',
 'Yes. Drag the length slider in the creator to pick anything from 5 to 30 seconds. Your choice is saved on the order and reused for extra videos from the same pack.':'Yes. Drag the length slider to choose 5 to 30 seconds. The generator shows the shared-credit cost before you start. You can choose a different length for your next generation.',
 'Yes. Every credit is a fresh scene. After your first video, the result page lets you rewrite the prompt and spend another credit on a different idea. Your optional reference photo is reused unless you start a new order.':'Yes. Write a fresh prompt for each generation, with or without one reference photo. Each generation uses the credit cost shown in the creator from your shared migosai balance.',
 'No. Credits stay attached to your private order link until you use them. Keep that link somewhere safe — without accounts, it is the only way back to your pack.':'Credit validity follows your existing migosai plan and pricing terms. Your balance belongs to your migosai account and is shared across its video tools.',
 'The credit is returned to your order automatically. You can then retry with the same prompt or a new one from the result page. A refund of credits does not change the original Stripe payment.':'Failed generations return credits through the existing migosai workflow. Check the error in My Videos and try again with the same prompt or a new scene.',
 "Rendering time depends on your chosen length and the provider's queue. We email your private link when it is ready, and the result page updates itself while you wait.":"Rendering time depends on your chosen length and the provider's queue. Check the status and your finished clip in My Videos.",
 'Write it, add a photo if you have one, and watch it take off. One-time pricing from $4.99 — a 10-second video is $9.99.':'Write it, add a photo if you have one, and watch it take off. Use the credits already shared by your migosai tools.',
}
def prose(s):
 if s in exact:return exact[s]
 if '$' in s:
  if s.startswith('Length is the main product decision.'):return 'Length is the main product decision. More frames mean more compute and more time in which the scene can change. Start with a length that supports one clear action, and review the credit cost shown by the creator. Existing migosai credit packs are listed in'
  if s.startswith('The chosen length is saved on the order'):return 'Choose the length for each generation. Its credit cost is shown before you start, and the balance is shared with your other migosai tools.'
  return BILLING
 s=s.replace('choose a pack','check the credit cost').replace('the order page','My Videos').replace('every credit in your pack','each generation')
 return s

def href(s):
 if s.startswith('mailto:'):return '/contact'
 if s.startswith('https://flyingcar-ai.app'):s=s[len('https://flyingcar-ai.app'):]
 if s in ['/privacy','/privacy/']:return '/privacy-policy'
 if s in ['/terms','/terms/']:return '/terms-of-service'
 if s=='/' or s.startswith('/#'):return BASE+s[1:]
 if s.startswith('#'):return BASE+s
 if any(s.startswith('/'+slug) for slug in [GUIDE,TREND]):return BASE+s
 return s

def faq_node(pairs,heading,attrs):
 return node('section',[node('h2',[heading])]+[
  node('details',[
   node('summary',[node('span',[prose(q)]),node('b',[],{'class':'faq-plus','aria-hidden':'true'})],{'class':'faq-trigger'}),
   node('div',[node('p',[prose(a)])],{'class':'faq-content'})
  ],{'class':'faq-row'}) for q,a in pairs
 ],attrs)

def clean(n):
 if isinstance(n,str):return prose(n)
 tag=n['tag'];a=n['attrs'];cls=a.get('class','')
 if tag in ['script','style','link','meta','iframe','object','embed']:return None
 if a.get('id')=='create':
  heading=next(c for c in n['children'] if isinstance(c,dict) and 'section-heading' in c['attrs'].get('class',''))
  return node('section',[clean(heading),{'slot':'generator'}],{'id':'create','class':cls})
 if a.get('id')=='pricing':return {'slot':'credits'}
 if a.get('id')=='faq':return faq_node(home_faq,'BEFORE YOU FLY: FLYING CAR VIDEO FAQ',{'id':'faq','class':'faq'})
 if tag=='section' and any(x['tag']=='h2' and txt(x)=='Frequently asked questions' for x in walk(n)):
  return faq_node(guide_faq,'Frequently asked questions',{'class':'article-faq'})
 attrs={}
 for k,v in a.items():
  if k.startswith('on') or k.startswith('data-radix') or (k=='id' and (v or '').startswith('radix-')):continue
  if k=='href':v=href(v)
  if k=='class':v=' '.join(CLASS_MAP.get(name,name) for name in v.split())
  if k in ['src','poster']:
   v=v.replace('https://images.chibistyle.art/flyingcar/real/','/flyingcar/real/').replace('/assets/flying-car-logo.svg','/flyingcar/flying-car-logo.svg')
  if k in ['class','id','href','src','alt','width','height','viewbox','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','d','cx','cy','r','x','y','rx','ry','xmlns','role','scope','loading','poster','autoplay','muted','loop','playsinline','preload','controls','type','style','title','tabindex','open'] or k.startswith('aria-') or k.startswith('data-'):attrs[k]=v
 if tag=='video':
  # Original lazy videos omit src in SSR; the deployed bundle supplies the matching MP4.
  attrs['src']=attrs.get('src') or attrs['poster'].replace('.jpg','.mp4')
  attrs['preload']='metadata'
  attrs['data-flyingcar-media']='reference'
 if tag=='main':tag='div';attrs['class']=(attrs.get('class','')+' flyingcar-main').strip()
 children=[c for child in n['children'] if (c:=clean(child)) is not None]
 return node(tag,children,attrs)

def coverage_units(main):
 units=[];excluded=[]
 def collect(n,slotted=False):
  if not isinstance(n,dict):return
  slotted=slotted or n['attrs'].get('id') in ['create','pricing']
  if n['tag'] in ['h1','h2','h3','h4','p','li','figcaption']:
   value=re.sub(r'\s+',' ',txt(n)).strip()
   if value:
    item={'tag':n['tag'],'text':value,'sha256':hashlib.sha256(value.encode()).hexdigest()}
    if slotted:excluded.append({**item,'reason':'Generator or shared-credit slot; verified by functional component tests.'})
    elif prose(value)!=value or re.search(r'\$|\b(?:pack|packs|Stripe|email|emailed|login|account|order|checkout|HEIC)\b|private (?:result )?link|no subscription',value,re.I):excluded.append({**item,'reason':'Billing, authentication, delivery or input-format adaptation for migosai.'})
    else:units.append(item)
  for child in n['children']:collect(child,slotted)
 collect(main)
 return {'preservedUnits':units,'adaptedOrSlottedUnits':excluded}

pages={};report={};legal={}
for slug in SLUGS:
 path=SOURCE/('index.html' if slug=='home' else slug+'.html');raw=path.read_text();p=Parser();p.feed(raw)
 if slug=='home':
  root=next(n for n in walk(p.root) if n['attrs'].get('id')=='root')
  main=node('div',[n for n in root['children'] if isinstance(n,dict) and n['tag'] not in ['header','footer','link']],{'class':'flyingcar-main'})
  pages['header']=clean(next(n for n in walk(root) if n['tag']=='header'))
  pages['footer']=clean(next(n for n in walk(root) if n['tag']=='footer'))
 else:main=next(n for n in walk(p.root) if n['tag']=='main')
 title=txt(next(n for n in walk(p.root) if n['tag']=='title'))
 desc=next(n['attrs']['content'] for n in walk(p.root) if n['tag']=='meta' and n['attrs'].get('name')=='description')
 if slug in ['privacy','terms']:legal[slug]={'title':title,'description':desc,'sourceContent':main,'displayPolicy':'Evidence only. Use the existing migosai legal pages.'}
 else:pages[slug]={'title':title,'description':prose(desc),'content':clean(main)}
 report[slug]={'source':'https://flyingcar-ai.app/'+('' if slug=='home' else slug),'sha256':hashlib.sha256(raw.encode()).hexdigest(),'sourceHeadings':[txt(n) for n in walk(main) if n['tag'] in ['h1','h2','h3']],'sourceTextCharacters':len(txt(main)),'faqCount':17 if slug=='home' else 6 if slug==GUIDE else 0,'coverage':coverage_units(main) if slug not in ['privacy','terms'] else None}
 if slug=='home':
  for _,answer in home_faq:
   unit={'tag':'faq-answer','text':answer,'sha256':hashlib.sha256(answer.encode()).hexdigest()}
   if prose(answer)==answer:report[slug]['coverage']['preservedUnits'].append(unit)
   else:report[slug]['coverage']['adaptedOrSlottedUnits'].append({**unit,'reason':'Billing, authentication, delivery or input-format adaptation for migosai.'})

interactions={
 'source':'https://flyingcar-ai.app/assets/index-nlP9j1ZZ.js',
 'evidence':'Deployed public JavaScript, inspected as text; no source bundle was executed.',
 'prompt':{'default':'','minLength':12,'maxLength':600,'trimBeforeValidation':True,'placeholder':'Describe the scene you want — place, time of day, camera move, mood.','help':'Describe the car, the place, the action and the camera. Include the vehicle model if you want a specific look.','presetCount':0,'publicSystemPrompt':None,'missingEvidence':'No private generation-system prompt or model request body is present in the public client bundle.'},
 'referenceImage':{'optional':True,'maxCount':1,'accept':['image/jpeg','image/png','image/webp','image/heic'],'advertisedMaxBytes':10*1024*1024,'consentRequired':True,'consentText':"It's my photo, or I have permission from anyone in it. No minors. No impersonation."},
 'duration':{'min':5,'max':30,'step':1,'default':10},
 'validationMessages':{'prompt': 'Describe your scene in at least 12 characters — one vivid sentence is enough.','upload':'Hold on — your photo is still uploading.','consent':'Tick the permission box to use your photo as a reference.'},
 'publicPromptFragments':[{'text':'The car rises out of the lane and clears the roof of the car in front','kind':'Illustrative phrase in the public tutorial; not a complete preset','source':'https://flyingcar-ai.app/'+GUIDE},{'text':'a flying car in traffic','kind':'Vague counterexample in the public tutorial; not a complete preset','source':'https://flyingcar-ai.app/'+GUIDE}],
 'promptChecklist':['Subject and geometry: the vehicle’s shape and colour, and how it sits in frame.','Action: one movement with a start and an end, described in space.','Environment: the street, overpass or skyline, and what sits near the car.','Camera: angle, height, distance, and whether it is static, tracking or handheld.','Light: time of day and light direction, which decides how readable the car is.'],
 'faq':{'homeSource':home_faq,'guideSource':guide_faq,'home':[[prose(q),prose(a)] for q,a in home_faq],'guide':[[prose(q),prose(a)] for q,a in guide_faq]},
 'examples':[{'slug':slug,'poster':'/flyingcar/real/'+slug+'.jpg','video':'/flyingcar/real/'+slug+'.mp4','durationSeconds':duration} for slug,duration in [('overpass-launch',15),('thruster-hover',10),('downtown-flyby',15),('highway-leap',10)]],
 'originalApiFlow':['POST /api/uploads → PUT uploadUrl → POST /api/uploads/:assetId/complete (optional)','POST /api/orders {prompt,imageAssetId,packageType,duration}','POST /api/orders/:orderToken/checkout','/wait/:orderToken → GET /api/orders/:orderToken','/result/:resultToken → GET /api/results/:resultToken','POST /api/orders/:orderToken/regenerate {prompt}'],
 'integrationPolicy':'Use migosai authentication, shared credits, generation API and My Videos. Do not call the original order/payment APIs.'
}
write('flyingcar-pages.json',pages)
write('flyingcar-source-legal.json',legal)
write('flyingcar-interactions.json',interactions)
raw_bundle=SOURCE/'assets/index-nlP9j1ZZ.raw.js'
manifest={'site':'https://flyingcar-ai.app/','pages':report,'publishedRoutes':['/','/'+GUIDE,'/'+TREND,'/privacy','/terms'],'privateRoutes':['/wait/:orderToken','/result/:resultToken'],'sourceBundle':{'url':interactions['source'],'sha256':hashlib.sha256((raw_bundle if raw_bundle.exists() else bundle).read_bytes()).hexdigest(),'formattedSha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),'note':'Exact response plus readable formatting of deployed source; public source map returned 404.'},'assets':json.loads((ROOT/'content/flyingcar-assets.json').read_text()),'changes':['Original payments replaced by existing migosai credits; authentication and My Videos replace anonymous orders and email links.','The original legal pages are archived as evidence; navigation uses migosai policies.','FAQ answers recovered from public literal arrays and rendered as native details/summary.','Four lazy SSR videos supplied their original MP4 sources from the deployed bundle.','HEIC removed from displayed accepted formats to match the existing migosai JPEG/PNG/WebP pipeline.'],'gaps':['No local or accessible GitHub source repository was found.','No private server system prompt was exposed; no system prompt has been invented.']}
write('flyingcar-source-manifest.json',manifest)
print('Imported 3 display pages, 2 original legal documents, 23 FAQ answers, 4 media pairs; slots: generator, credits.')
