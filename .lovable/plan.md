

## Plan

### 1. Add WASM version badge to Cam Player page
Add a badge next to the page title showing the current WASM build version. Since the WASM file doesn't embed a version string, we'll use the file's last-modified date from the HTTP response header when loading it. This gives a unique identifier per build (e.g., "Build: 2026-03-05").

**`src/components/TibiarcPlayer.tsx`**: During WASM init, fetch the `.wasm` file's `Last-Modified` header and expose it via a new state/callback. Store the date string in state.

**`src/pages/CamPlayerPage.tsx`**: Display a `Badge` with the WASM build date next to the title. Remove the info box at the bottom (lines 74-81).

### 2. Remove the replay info footer
Remove the "About" info box section from `CamPlayerPage.tsx` (the `<div>` with `Info` icon, `aboutTitle`, and `aboutDescription`).

### Files changed
- `src/components/TibiarcPlayer.tsx` — Fetch and expose WASM last-modified date
- `src/pages/CamPlayerPage.tsx` — Add version badge, remove info box

