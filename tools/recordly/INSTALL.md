# Recordly — install & record ProofPass demo

Recordly is a desktop screen recorder (electron-based, MIT-style). Downloaded
from the official GitHub release into this directory:

```
tools/recordly/Recordly-linux-x64.AppImage   227 MB, v1.3.3 (Jun 2026)
```

Source: https://github.com/webadderallorg/Recordly
Release: https://github.com/webadderallorg/Recordly/releases/tag/v1.3.3

## Install (Linux)

```bash
cd tools/recordly
chmod +x Recordly-linux-x64.AppImage
./Recordly-linux-x64.AppImage
```

If FUSE is missing on the host (Ubuntu 22+ often does):

```bash
# option A: enable FUSE
sudo apt install libfuse2

# option B: extract & run
./Recordly-linux-x64.AppImage --appimage-extract
./squashfs-root/AppRun
```

## Install (macOS)

```bash
# arm64 (Apple Silicon)
curl -L -o /tmp/Recordly.dmg https://github.com/webadderallorg/Recordly/releases/download/v1.3.3/Recordly-arm64.dmg
open /tmp/Recordly.dmg

# or x64 (Intel)
curl -L -o /tmp/Recordly.dmg https://github.com/webadderallorg/Recordly/releases/download/v1.3.3/Recordly-x64.dmg
open /tmp/Recordly.dmg
```

## Install (Windows)

Download `Recordly-windows-x64.exe` from the release page and run it.

## Recording the ProofPass demo

Recordly is GUI-only — record on your machine, then push the rendered video
into `frontend/public/videos/proofpass-demo.mp4` so the README link resolves.

### Settings for the ProofPass video

| Setting              | Value                                  |
|----------------------|----------------------------------------|
| Resolution           | 1920 × 1080 (or your laptop's native) |
| Frame rate           | 30 fps                                  |
| Output format        | mp4 (h.264)                            |
| Audio source         | none (we drop voice over the silent video later) |
| Cursor highlight     | ON                                     |
| Webcam picture-in-pic | OFF (clean screen demo)               |

### Shot list (timed)

The video target is 2 minutes (120 s). The voice-over script at
`tools/recordly/VOICEOVER_SCRIPT.md` is timed to the second against this shot list.

| Time         | Shot                                                                 |
|--------------|----------------------------------------------------------------------|
| 0:00 – 0:08  | Title card: "Prove you qualify. Don't share your financial life."    |
| 0:08 – 0:18  | The problem: rental qualification = bank statements, salary, history |
| 0:18 – 0:40  | Renter flow: connect wallet → enter income `5000` → threshold `3000`  |
| 0:40 – 1:10  | Proof generates in browser (~30 s); show Soroban verification step     |
| 1:10 – 1:25  | Switch to landlord view: only YES, threshold, expiry, tx link        |
| 1:25 – 1:40  | Switch to Market view: list of qualified renters                     |
| 1:40 – 1:55  | Side-by-side: what the renter entered vs what the landlord saw        |
| 1:55 – 2:00  | End card: proofpass on Stellar, GitHub link                          |

### Post-process

1. Drop the video into `frontend/public/videos/proofpass-demo.mp4`.
2. Upload to YouTube (unlisted OK).
3. Paste the URL into `README.md` under "Demo video".
4. Commit:
   ```bash
   git add frontend/public/videos/proofpass-demo.mp4 README.md
   git commit -m "docs: add ProofPass demo video"
   ```
