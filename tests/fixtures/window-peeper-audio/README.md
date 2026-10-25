# Synthetic remux fixtures

These files contain only FFmpeg `testsrc2` color patterns and generated sine waves. They contain no user portrait, production result, copyrighted song, or production credential. FFmpeg is needed only to regenerate fixtures, not to run the tests.

- `video-with-audio.mp4`: 15-second AVC, 64×48 coded pixels, 4 fps / 60 packets, no B-frames, 90° clockwise display matrix; an unrelated 880 Hz AAC track stands in for model audio.
- `video-with-bframes.mp4`: the same synthetic scene encoded with B-frames, retained as a rejection case. Mediabunny 1.61 fragmented MP4 output has a verified negative-CTO timing mismatch in FFmpeg and Chrome for this input.
- `source-avc-no-audio.mp4`: the same unrotated AVC stream, with no audio.
- `short-avc.mp4`: a 2-second packet-copy excerpt, rejected by the 14–16 second input contract.
- `soundtrack.m4a`: 16-second mono 440 Hz AAC at 48 kHz. Its first packet has a negative presentation timestamp from encoder priming.

Reproduction commands (the intermediate `base.mp4` is temporary):

```sh
ffmpeg -f lavfi -i 'testsrc2=size=64x48:rate=4:duration=15' -f lavfi -i 'sine=frequency=880:sample_rate=48000:duration=15' -c:v libx264 -preset veryfast -crf 36 -pix_fmt yuv420p -bf 0 -x264-params 'keyint=8:min-keyint=8:scenecut=0' -c:a aac -b:a 24k -movflags +faststart base.mp4
ffmpeg -display_rotation:v:0 -90 -i base.mp4 -map 0 -c copy -movflags +faststart video-with-audio.mp4
ffmpeg -i base.mp4 -map 0:v:0 -c copy -an -movflags +faststart source-avc-no-audio.mp4
ffmpeg -i base.mp4 -t 2 -map 0:v:0 -c copy -an -movflags +faststart short-avc.mp4
ffmpeg -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=16' -c:a aac -b:a 32k -movflags +faststart soundtrack.m4a
```

To recreate `video-with-bframes.mp4`, use the same scene command with `-bf 2` and `-x264-params 'b-adapt=0:keyint=8:min-keyint=8:scenecut=0'`, then apply the same display-rotation remux to that file.
