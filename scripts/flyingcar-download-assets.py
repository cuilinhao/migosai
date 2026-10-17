"""Mirror the exact public Flying Car AI media; no browser or source code execution.
Rebuild: python3 scripts/flyingcar-download-assets.py
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[1]
MEDIA='https://images.chibistyle.art/flyingcar/real/'
SITE='https://flyingcar-ai.app'
items=[(MEDIA+slug+ext,'real/'+slug+ext) for slug in ['overpass-launch','thruster-hover','downtown-flyby','highway-leap'] for ext in ['.jpg','.mp4']]
items += [(SITE+'/assets/fonts/'+name,'fonts/'+name) for name in ['9e9f04e3c37952ab-s.p.002ht2t_o636a.woff2','75affa71d1e2f6a7-s.p.13rul5q9jl2r0.woff2']]
items += [(SITE+'/assets/flying-car-logo.svg','flying-car-logo.svg'),(SITE+'/assets/og-flying-car-v2.png','og-flying-car-v2.png'),(SITE+'/favicon.svg','favicon.svg')]
def fetch(item):
 url,relative=item;dest=ROOT/'public/flyingcar'/relative;dest.parent.mkdir(parents=True,exist_ok=True)
 subprocess.run(['curl','--fail','--silent','--show-error','--location','--retry','3',url,'-o',str(dest)],check=True)
 data=dest.read_bytes()
 if data.lstrip().lower().startswith(b'<!doctype html'):raise ValueError('HTML response for '+url)
 return {'source':url,'path':'/flyingcar/'+relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
with ThreadPoolExecutor(max_workers=4) as pool:manifest=list(pool.map(fetch,items))
(ROOT/'content/flyingcar-assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Mirrored',len(manifest),'assets;',sum(m['bytes'] for m in manifest),'bytes')
