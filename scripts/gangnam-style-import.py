"""Import the observed public home DOM. Never execute the reference site's scripts.
Usage: python3 scripts/gangnam-style-import.py <original.html>
"""
from html.parser import HTMLParser
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class Parser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root={'tag':'div','attrs':{},'children':[]};self.stack=[self.root]
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
  for c in n.get('children',[]):yield from walk(c)
def text(n):return n if isinstance(n,str) else ''.join(text(c) for c in n.get('children',[]))
def classes(n):return n.get('attrs',{}).get('class','').split()
p=Parser();p.feed(Path(sys.argv[1]).read_text())
site=next(n for n in walk(p.root) if 'groove-site' in classes(n))
main=next(n for n in site['children'] if isinstance(n,dict) and n['tag']=='main')
main['tag']='div';main['attrs']={'class':'content'}
links={'/terms':'/terms-of-service','/privacy':'/privacy-policy','/refunds':'/refund-policy','/contact':'/contact','/pricing':'#pricing','/gangnam-style-ai-selfie':'#studio-selfie','/gangnam-style-ai-pet':'#studio-pets'}
replacements={
 'No subscription. Pay $9.90 for one video credit or $15.90 for two, plus any applicable checkout taxes or conversion. Waffo processes payment; credits appear after payment confirmation.':'Use your existing MigosAI credits. One-time credit packs and subscriptions are available on the MigosAI pricing page. The generator shows the cost before submission.',
 'Yes. Sign in with Google to create videos and access your account.':'Yes. Sign in with your MigosAI account to create videos and access your account.',
 'No. Groove is an independent AI creative service and is not affiliated with or endorsed by the artist, labels or social platforms.':'No. MigosAI is an independent AI creative service and is not affiliated with or endorsed by the artist, labels or social platforms.',
}
def clean(n):
 if isinstance(n,str):return replacements.get(n,n)
 a=n['attrs'];c=classes(n)
 if n['tag'] in ['script','dialog','style','link','meta','iframe']:return None
 if 'hero-media' in c:return {'slot':'hero-media'}
 if 'cards' in c:return {'slot':'examples'}
 if 'form' in c:return {'slot':'generator'}
 if a.get('id')=='pricing':return {'slot':'pricing'}
 a={k:v for k,v in a.items() if not k.startswith('on') and not k.startswith('data-')}
 if 'class' in a:a['class']=' '.join('gns-'+name for name in c)
 for key in ['src','poster']:
  if a.get(key,'').startswith('/assets/'):a[key]=a[key].replace('/assets/','/gangnam-style/',1)
 if 'href' in a:
  url=a['href'];a['href']=links.get(url,url)
  if url.startswith('/guides'):
   a['href']='https://gangnamstyle.io'+url;a['target']='_blank';a['rel']='noreferrer'
 return {'tag':n['tag'],'attrs':a,'children':[v for child in n['children'] if (v:=clean(child)) is not None]}
content=clean(main)
page={'source':'https://gangnamstyle.io/','retrievedAt':'2026-10-27','title':'Gangnam Style AI Video Generator & Trio Templates','description':'Make the Gangnam Style AI trio trend from three photos or one selfie. Explore friends, selfie and pet video templates, photo tips and step-by-step guides.','content':content}
(ROOT/'content/gangnam-style-page.json').write_text(json.dumps(page,ensure_ascii=False,indent=2)+'\n')
print('Imported',len(list(walk(content))),'nodes; FAQ:',sum(n.get('tag')=='details' for n in walk(content)))
