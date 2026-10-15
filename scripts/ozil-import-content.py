"""Rebuild reviewed Ozil public-page data from saved SSR snapshots (never executes source JS).
Usage: python3 scripts/ozil-import-content.py /tmp/ozil-source
"""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1])
SLUGS=['home','ozil-goal-ai-prompt','ozil-goal-ai-template','ozil-goal-trend','ozil-goal-meme','ozil-goal-capcut-template','ai-football-video-from-photo']
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
 if isinstance(n,dict):
  yield n
  for c in n['children']:yield from walk(c)
def txt(n):return n if isinstance(n,str) else ''.join(txt(c) for c in n['children'])
def has(n,id):return any(x['attrs'].get('id')==id for x in walk(n))
CREDIT='{{OZIL_GOAL_COST}} credits per video'
BILLING='Each 15-second, 9:16 video with sound uses '+CREDIT+'. Sign in with your migosai account and use your shared credits. Failed generations return credits through the existing generation workflow. Finished videos appear in My videos; download the results you want to keep. Photo handling follows the migosai Privacy Policy.'
exact={
'Pay once, no subscription':'Uses your shared migosai credits',
'Pay once.':'Shared credits.',
'Your photo is not kept.':'Photo handling follows our Privacy Policy.',
'Under 8 MB':'Under 8 MB recommended (generator accepts up to 10 MB)',
'JPG, PNG or WebP, under 8 MB, at least 300 pixels on each side, and not extremely narrow or wide. A normal phone photo almost always passes.':'JPG, PNG or WebP. This checker recommends a file under 8 MB, at least 300 pixels on each side, and not extremely narrow or wide. The migosai generator accepts images up to 10 MB; a normal phone photo usually meets these recommendations.',
'Failed render: video back':'Failed render: credits returned',
'Photo deleted after the render':'Your existing migosai account',
'No real player, kit or footage':'AI-generated scene and characters',
'Made with this generator from one AI-generated portrait (not a real person). Your video uses your own photo.':'Original Ozil Goal reference sample, made from an AI-generated portrait. Your new video uses your own photo with MiniMax H3; results vary.',
'Made here from one AI-generated portrait.':'Original Ozil Goal reference sample, made from an AI-generated portrait.',
'Made here':'Reference',
'These frames come from a real clip made with this generator. Every render follows the same order and timing; the small details (kit colours, camera, where the keeper lands) change from one render to the next.':'These frames come from the original Ozil Goal reference clip. Our MiniMax H3 template uses the same three-beat motion reference. The generated movement, timing, clothing and identity can vary.',
'Frames from a clip made with this site from an AI-generated portrait. Details such as kit colours and camera angle vary between renders; the order and timing do not.':'Frames from the original Ozil Goal reference clip, made from an AI-generated portrait. New MiniMax H3 results can vary in timing, camera, clothing and identity.',
'Every render follows the same order and timing. Small details such as kit colours, the camera path and where the keeper lands change from render to render.':'The template requests the same three-beat order using a motion reference. Timing, kit colours, camera paths and generated movement can vary.',
'Nothing to write or tune: the stadium, the players, the camera and the timing are already set. Sign in, pick a pack once, and the render starts.':'Nothing to write or tune: the stadium, players, camera and motion reference are already set. Sign in with your migosai account, check the credit cost, and start the render.',
'About 5 to 8 minutes':'Generation time varies',
'About 5 to 8 minutes.':'Generation time varies.',
'About 5 to 8 minutes, page can be closed':'Generation time varies; check My videos',
'Google or an email code':'Your migosai account',
'Sign in with Google or an email code':'Sign in with your migosai account',
'Video back to your balance':'Credits returned after failure',
'Video goes back to your balance automatically':'Failed generations return credits',
'A failed render goes back to your balance':'A failed generation returns credits',
'The video goes straight back to your balance and you can try again with the same or a different photo. You only pay for videos that finish.':'Failed generations return credits through the existing migosai generation workflow. Review the error in My videos before trying again.',
'Usually 5 to 8 minutes. You can close the page while it renders; the finished clip waits in My videos.':'Generation time varies with provider demand. You can check progress and finished clips in My videos.',
'It is used only to make your video, processed by our video generation provider for that purpose, and deleted when the render ends. We do not publish your photos or videos, use them to train AI, or build face profiles.':'Your photo is processed to create the video through the migosai generation provider. Photo handling and retention follow the migosai Privacy Policy; this page does not promise deletion immediately after rendering.',
'It is used only to make your video and is deleted when the render ends. The checker on this page never uploads anything; it reads the file in your browser.':'Photo handling follows the migosai Privacy Policy. The checker on this page never uploads anything; it reads the file in your browser.',
' It is used only to make the video and deleted when the render ends.':' Photo handling follows the migosai Privacy Policy.',
'Finished videos are kept for 30 days with the 1 video pack, and for 1 year once you have bought 3 or 7 videos. Download the ones you want to keep.':'Finished videos appear in your shared migosai My videos history. Download the results you want to keep; there is no separate Ozil pack retention period.',
'Finished videos are kept for 30 days with the 1-video pack and for 1 year with the 3 or 7 video packs. Videos you have paid for but not used yet never expire.':'Finished videos appear in your shared migosai My videos history. Download the results you want to keep. Shared credits follow the migosai pricing terms.',
'One photo · 15s · from $5.70 a video':'One photo · 15s · '+CREDIT,
'15s · 9:16 · from $5.70 a video · a failed render costs nothing':'15s · 9:16 · '+CREDIT+' · failed generations return credits',
'$8.90, or from $5.70 in packs':CREDIT,
'$8.90 a video, from $5.70 in packs':CREDIT,
'$5.70 to $8.90 a video':CREDIT,
'$8.90 a video, $5.70 each in a 7 pack':CREDIT,
'The trend’s sound':'Generated sound guided by the reference',
'support@ozilgoal.com':'Contact migosai support',
'People in videos made here are AI-generated.':'Videos are AI-generated and may use a consenting adult’s photo.',
}
def prose(s):
 if s in exact:return exact[s]
 if '$' in s:
  if 'Yes. Copy it' in s:return 'Yes. Copy it, change it and use it wherever you like. Rendering in another tool may cost money there. A video on this site uses '+CREDIT+' from your shared migosai balance.'
  if 'CapCut template runs' in s:return 'A CapCut template runs in the CapCut app; availability and pricing depend on CapCut. Ours runs in a browser, takes one photo and requests a 15-second scene using '+CREDIT+'.'
  if 'Using CapCut templates' in s:return 'CapCut controls its own template availability and pricing. Ozil Goal on migosai uses '+CREDIT+' from your shared balance.'
  if 'One video costs' in s:return 'A new video uses '+CREDIT+' from your shared migosai balance. Want the background first? Read about'
  if s.startswith('No. One video'):return 'No. Each new video uses '+CREDIT+' from your shared migosai balance. CapCut may offer a free route; availability and pricing depend on CapCut.'
  return BILLING
 s=s.replace('with the trend’s sound','with generated sound guided by the reference').replace("with the trend's sound",'with generated sound guided by the reference')
 s=s.replace('About 5 to 8 minutes later','When generation finishes,').replace('about 5 to 8 minutes later','when generation finishes,').replace('Usually about 5 to 8 minutes','Generation time varies').replace('Rendering takes about 5 to 8 minutes.','Rendering time varies.').replace('It takes about 5 to 8 minutes','Generation time varies')
 s=s.replace('People in videos made here are AI-generated.', 'Videos are AI-generated and may use a consenting adult’s photo.')
 s=s.replace('Google or an email code','your migosai account')
 s=s.replace('the video goes back to your balance automatically','the credits return through the existing migosai generation workflow').replace('the video goes back to your balance','the credits return to your shared balance').replace('the video returns to your balance automatically','credits return through the existing migosai generation workflow')
 s=s.replace('Your photo is used only to make the video and is deleted when the render ends.','Photo handling follows the migosai Privacy Policy.')
 s=s.replace('Our own generator handles this differently: the timing and the moves come from the trend clip itself, and your photo only supplies the person.','Our generator uses MiniMax H3 with a fixed motion reference from the original trend sample, while your photo supplies the person. Results can vary.')
 s=s.replace('always produces the same 15-second scene','requests the same 15-second scene')
 return s

def href(s):
 if s.startswith('mailto:'):return '/contact'
 if s.startswith('https://ozilgoal.com'):s=s[len('https://ozilgoal.com'):]
 if s.startswith('/auth/'):return '/sign-in'
 if s=='/my-videos':return '/app/my-videos'
 if s in ['/llms.txt','/llms-full.txt']:return '/ozil-goal-generator'
 if s=='/' or s.startswith('/#'):return '/ozil-goal-generator'+s[1:]
 if any(s.startswith('/'+slug) for slug in SLUGS[1:]):return '/ozil-goal-generator'+s
 return s

def clean(n):
 if isinstance(n,str):return prose(n)
 tag=n['tag'];a=n['attrs'];cls=a.get('class','')
 if tag=='a' and a.get('href') in ['/llms.txt','/llms-full.txt']:return None
 if tag in ['script','style','link','meta','iframe','object','embed']:return None
 if a.get('aria-label')=='Contact support':return None
 if a.get('id')=='generator':return {'tag':'div','attrs':{'id':'generator','class':cls+' og-generator-shell'},'children':[{'slot':'generator'}]}
 if a.get('id')=='pricing':return {'slot':'credits'}
 if a.get('id')=='builder':return {'slot':'prompt'}
 if a.get('id')=='route-chooser':return {'slot':'route-chooser'}
 if a.get('id')=='photo-check':return {'slot':'template-check'}
 if cls.startswith('og-reveal rounded-2xl') and has(n,'caption-who'):return {'slot':'captions'}
 if cls.startswith('og-reveal grid gap-6') and has(n,'photo-check-file'):return {'slot':'photo-check'}
 if cls.startswith('og-reveal grid gap-6') and has(n,'beat-time'):return {'slot':'timeline'}
 if tag=='video':return {'slot':'guide-sample-video'}
 if tag=='figure' and any(x['tag']=='video' for x in walk(n)):return {'slot':'sample'}
 attrs={}
 for k,v in a.items():
  if k.startswith('on') or k.startswith('data-track') or k.startswith('data-base'):continue
  if k=='href':v=href(v)
  if k in ['src','poster']:
   v=v.replace('https://assets.ozilgoal.com/','/ozil-goal/')
   if v=='/logo.png':v='/ozil-goal/logo.png'
  if k in ['class','id','href','src','alt','width','height','viewbox','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','d','cx','cy','r','x','y','rx','ry','xmlns','role','scope','loading','poster','autoplay','muted','loop','playsinline','preload','controls','type','style','title','tabindex','inert'] or k.startswith('aria-') or k.startswith('data-'):attrs[k]=v
 if tag=='video':attrs['aria-label']='Original Ozil Goal reference sample'
 if tag=='button' and (m:=re.match(r'Play beat (\d)',a.get('aria-label',''))):attrs['data-og-seek']=str(int(m[1])-1)
 if tag=='main':tag='div';attrs['class']=(attrs.get('class','')+' og-main').strip()
 children=[c for child in n['children'] if (c:=clean(child)) is not None]
 return {'tag':tag,'attrs':attrs,'children':children}

pages={};report={}
for slug in SLUGS:
 raw=(SOURCE/(slug+'.html')).read_text();p=Parser();p.feed(raw)
 main=next(n for n in walk(p.root) if n['tag']=='main')
 footer=next(n for n in walk(p.root) if n['tag']=='footer')
 title=txt(next(n for n in walk(p.root) if n['tag']=='title'))
 desc=next(n['attrs']['content'] for n in walk(p.root) if n['tag']=='meta' and n['attrs'].get('name')=='description')
 result=clean(main)
 pages[slug]={'title':title,'description':re.sub(r'from \$5\.70(?: a video)?',CREDIT,desc),'content':result}
 report[slug]={'source':'https://ozilgoal.com/'+('' if slug=='home' else slug),'sha256':hashlib.sha256(raw.encode()).hexdigest(),'sourceHeadings':[txt(n) for n in walk(main) if n['tag'] in ['h1','h2','h3']],'sourceFaqCount':sum(1 for n in walk(main) if n['tag']=='details')}
 if slug=='home':pages['footer']=clean(footer)
(ROOT/'content/ozil-goal-pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2)+'\n')
(ROOT/'content/ozil-goal-source-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Imported 7 pages; FAQ counts:',{s:r['sourceFaqCount'] for s,r in report.items()})

# Literal arrays only: turn known data-object keys into JSON. Never eval a source bundle.
def source_array(pattern,start,end):
 js=next(SOURCE.glob(pattern)).read_text()
 raw='['+js.split(start,1)[1].split(end,1)[0]
 raw=re.sub(r'([{,])([a-zA-Z][a-zA-Z0-9]*):',r'\1"\2":',raw).replace('!0','true').replace('!1','false')
 return json.loads(raw)
interactions={
 'templateChecks':source_array('ozil-goal-ai-template-*.js','const d=[',';function k'),
 'photoChecks':source_array('ai-football-video-from-photo-*.js','],r=[',';async function $'),
 'captionMoods':source_array('ozil-goal-meme-*.js',',W=[',',I=['),
 'captions':source_array('ozil-goal-meme-*.js',',I=[',',c=('),
 'beatExplanations':source_array('ozil-goal-trend-*.js','const f=[',',w='),
}
(ROOT/'content/ozil-goal-interactions.json').write_text(json.dumps(interactions,ensure_ascii=False,indent=2)+'\n')
prompt=Parser();prompt.feed((SOURCE/'ozil-goal-ai-prompt.html').read_text())
original_prompt=txt(next(n for n in walk(prompt.root) if n['tag']=='pre'))
(ROOT/'tests/ozil-content-prompt-default.txt').write_text(original_prompt)
