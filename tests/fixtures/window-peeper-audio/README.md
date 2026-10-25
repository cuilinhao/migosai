# Synthetic video fixture

`video-with-audio.mp4` contains only FFmpeg `testsrc2` color patterns and an 880 Hz sine wave. It contains no user portrait, production result, copyrighted song, or credential.

The fixture is a 15-second AVC video, 64×48 coded pixels, 4 fps / 60 frames, with a 90° clockwise display matrix. The unrelated AAC tone stands in for model-generated audio. Tests use it to verify that the completed FFmpeg result is saved unchanged through the existing R2 and moderation pipeline. Live FFmpeg acceptance separately verifies replacement with the fixed soundtrack.

FFmpeg is needed only to regenerate the fixture:

```sh
ffmpeg -f lavfi -i 'testsrc2=size=64x48:rate=4:duration=15' -f lavfi -i 'sine=frequency=880:sample_rate=48000:duration=15' -c:v libx264 -preset veryfast -crf 36 -pix_fmt yuv420p -bf 0 -x264-params 'keyint=8:min-keyint=8:scenecut=0' -c:a aac -b:a 24k -movflags +faststart base.mp4
ffmpeg -display_rotation:v:0 -90 -i base.mp4 -map 0 -c copy -movflags +faststart video-with-audio.mp4
```
