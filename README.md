# Stream Sync Friends

A Chrome extension + Vercel backend for delaying local HTML5 video playback so friends watching the same live sports event from different sources can line up.

The MVP intentionally does **not** intercept or rebroadcast video. It only controls each viewer's local `<video>` element: pause/resume, small playback-rate adjustments, and manual nudges.

## How it works

1. Everyone loads the extension.
2. One person creates a room name and shares it.
3. Each browser reports its current video time and wall-clock timestamp to the backend.
4. The backend estimates every participant's current media position.
5. The extension aligns everyone to the slowest participant.

Because different sports streams often have different clocks, ad breaks, or non-DVR live edges, the extension also includes manual calibration and nudge controls.

## Repo layout

- `extension/` — Chrome Manifest V3 extension
- `backend/` — Next.js API backend deployable to Vercel

## Backend deployment

The backend works locally with in-memory room state. For Vercel production, configure Upstash Redis env vars so room state survives serverless invocations:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Then deploy:

```bash
cd backend
npm install
vercel --prod
```

## Extension setup

1. Deploy the backend or run it locally.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Load unpacked extension from `extension/`.
5. Open a streaming site with an HTML5 video.
6. Click the extension, set the backend URL, room, and display name.

For local backend:

```bash
cd backend
npm install
npm run dev
```

Use backend URL `http://localhost:3000`.

## Current limitations

- Polling-based sync, not WebSocket real-time.
- Works only with pages exposing an HTML5 `<video>` element.
- DRM streams are okay as long as playback controls are accessible, but stream bytes are never inspected.
- Cross-source auto-matching is not implemented yet. Manual mark/nudge controls are the practical sports MVP.

## Roadmap

- Better calibration flow: “mark kickoff/puck drop now.”
- Audio fingerprinting opt-in for auto-offset detection.
- Room invite links.
- Per-site adapters for common sports platforms.
- Mobile companion controller.
