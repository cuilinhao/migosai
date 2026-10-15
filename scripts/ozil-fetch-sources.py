"""Download public clone evidence using curl. No downloaded JavaScript is executed.
Usage: python3 scripts/ozil-fetch-sources.py /tmp/ozil-source
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,re,sys
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
slugs=['home','ozil-goal-ai-prompt','ozil-goal-ai-template','ozil-goal-trend','ozil-goal-meme','ozil-goal-capcut-template','ai-football-video-from-photo']
def fetch(item):
 url,path=item
 subprocess.run(['curl','--fail','--location','--silent','--show-error',url,'-o',str(path)],check=True)
with ThreadPoolExecutor(max_workers=7) as pool:
 list(pool.map(fetch,[('https://ozilgoal.com/'+('' if slug=='home' else slug),out/(slug+'.html')) for slug in slugs]))
assets=set()
for slug in slugs:
 assets.update(re.findall(r'"(/assets/[^"/]+\.(?:css|js))"',(out/(slug+'.html')).read_text()))
with ThreadPoolExecutor(max_workers=7) as pool:
 list(pool.map(fetch,[('https://ozilgoal.com'+asset,out/asset.rsplit('/',1)[-1]) for asset in assets]))
print(f'Saved {len(slugs)} pages and {len(assets)} source assets in {out}')
