# ClarityTrack Employee Desktop

The main ClarityTrack product is a **web app** (Next.js). Employee work sessions can also run inside this **Electron desktop shell**, which:

- opens as a native Windows/macOS/Linux window
- points at your ClarityTrack server URL
- reads **OS-level idle** via Electron `powerMonitor` (stronger than browser-tab idle alone)

Admin portal stays web-based.

## Run

1. Start the ClarityTrack server (repo root):

```bash
npm install
npm run build
npm run start
```

2. In another terminal:

```bash
cd desktop
npm install
CLARITYTRACK_URL=http://127.0.0.1:43123 npm start
```

For a public tunnel URL:

```bash
CLARITYTRACK_URL=https://your-tunnel.trycloudflare.com npm start
```

Sign in with an **approved employee** account (Admin login is still available on the same server in a browser).
