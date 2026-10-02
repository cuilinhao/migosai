"""Create web copies of user-supplied showcase media; never changes originals."""
from pathlib import Path
import subprocess, json
root = Path(__file__).resolve().parents[1]
materials = root.parent
videos = root / 'public/videos'
posters = root / 'public/posters'
videos.mkdir(parents=True, exist_ok=True)
posters.mkdir(parents=True, exist_ok=True)
manifest = []
for index in range(1, 9):
    suffix = '' if index == 1 else f'({index - 1})'
    source = materials / f'Showcases — Migos AI{suffix}.mp4'
    output = videos / f'showcase-{index:02}.mp4'
    poster = posters / f'showcase-{index:02}.jpg'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-vf','scale=min(1280\\,iw):-2','-c:v','libx264','-crf','24','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart','-c:a','aac','-b:a','96k',str(output)],check=True)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-frames:v','1','-vf','scale=1280:-2','-q:v','3',str(poster)],check=True)
    if output.stat().st_size > source.stat().st_size:
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-c','copy','-movflags','+faststart',str(output)],check=True)
    item={'index':index,'source':source.name,'video':str(output.relative_to(root/'public')),'poster':str(poster.relative_to(root/'public')),'originalBytes':source.stat().st_size,'webBytes':output.stat().st_size}
    manifest.append(item)
    print(json.dumps(item,ensure_ascii=False),flush=True)
(root/'RECON/local-video-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
