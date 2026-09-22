# The Tiger and the Fish — புலியும் மீனும்

A 2-player online co-op side-scroller. Two friends, seven trials, one lost Tamil kingdom.
Built for the Handshake AI Skills Studio "Create a Multiplayer Game" challenge (Oct 2026).

## Play
1. Open the game URL. One player clicks **Create a room** (plays Kumaran) and gets a 4-letter code.
2. The other player opens the same URL on their own device, enters the code, clicks **Join** (plays Selvam).
3. Read each trial's rule card, click "ready" — the trial starts when both are ready.

No accounts, no downloads, no server. The two browsers talk directly over WebRTC (PeerJS).

## Deploy (any static host)
The whole game is static files: `index.html` plus the `.js` files. Upload the folder as-is.

**GitHub Pages:** create a repo → upload these files → Settings → Pages → Source: main branch, root → your URL is `https://<user>.github.io/<repo>/`.

**Netlify / Vercel:** drag-and-drop the folder.

## Dev / testing on one machine
Open two tabs with `?local` in the URL (`index.html?local`) — they connect through the browser's BroadcastChannel instead of WebRTC.
`?solo=2` skips straight to Trial I as host without a partner (for screenshots).
Press F3 in-game for debug info.

## Controls
← → move · ↑ / Space jump & climb · Shift hold/brace · E interact / throw stone. Touch controls appear on phones.

## Status — v1
Intro (6 painted panels) · Trial I The Drowned Reef · Trial II The Blind Hunters · Trial III The Rope Gorge · Act I end card.
Coming: Trials IV–VII, the Kingdom, the Drum, the Last Drum, the ending.

All art, music, text and code are original and procedural (no external assets).
