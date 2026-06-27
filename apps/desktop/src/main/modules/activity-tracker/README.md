# Activity Tracker module

The **desktop activity data connector** for the Work Rhythm Module
(README §9 Module 1, §17). It samples the foreground window across macOS,
Windows and Linux and derives privacy-friendly signals: per-app screen time,
continuous work sessions, breaks, context switching and late-night work.

## Design

```
tracker.ts ── polling loop, idle gating, day rollover, persistence
  ├─ providers/        how we read the active window (cross-platform)
  │    ├─ getWindowsProvider.ts   native `get-windows` (primary)
  │    ├─ shellProvider.ts        osascript / powershell / xdotool|xprop (fallback)
  │    └─ index.ts                composite: native first, shell fallback, self-healing
  ├─ idle.ts           Electron powerMonitor (idle seconds + idle/locked state)
  ├─ categories.ts     app → Work Rhythm category (coding, meeting, …)
  ├─ aggregator.ts     per-day state machine → sessions, breaks, app usage, events
  ├─ store.ts          atomic JSON persistence under userData/activity/
  ├─ ipc.ts            invoke handlers + pushed update/event messages
  └─ channels.ts       shared IPC channel names (also used by the preload)
```

The tracker is **off by default** and is started/stopped from the renderer over
IPC, so nothing is tracked until the module is explicitly enabled.

### How time is attributed

Every `pollIntervalMs` (default 4s) the tracker:

1. Reads idle state via `powerMonitor`. Past `idleThresholdSec` (default 60s)
   of no input — or a locked screen — the interval is counted as idle, not
   attributed to any app.
2. Otherwise reads the active window and attributes the elapsed interval to that
   app and category. The interval is capped at `3×pollInterval` so a missed tick
   (sleep / stall) can't dump a huge block onto one app; `suspend`/`resume` and
   `lock`/`unlock` events end the session and skip the gap.
3. A continuous run of active time is a **work session**. An idle gap longer than
   `breakThresholdSec` (default 5 min), or a lock, closes the session as a
   `work_session.continuous` event and counts a **break**.

## Privacy

- Only derived signals are stored (app name, category, durations, counts).
- Window **titles** are off by default (`captureTitles`), and **browser URLs**
  are off by default (`captureUrls`). On macOS these gate the screen-recording
  and accessibility permission prompts respectively — left off, the tracker runs
  without prompting.
- Data is local-first: one JSON file per day under
  `app.getPath('userData')/activity/YYYY-MM-DD.json`.

## Platform notes

| Platform | Primary (`get-windows`)        | Shell fallback                     |
| -------- | ------------------------------ | ---------------------------------- |
| macOS    | prebuilt Swift CLI helper      | `osascript` (System Events) + `ps` |
| Windows  | native addon                   | `powershell` + user32 P/Invoke     |
| Linux    | native addon (X11)             | `xdotool` or `xprop` + `/proc`     |

**Wayland (Linux):** there is no generic way to read the focused window, so both
providers report unavailable there. The tracker keeps running (everything is
counted as idle) rather than crashing.

## Packaging

- `get-windows` is ESM-only and the main bundle is CommonJS, so it is loaded via
  dynamic `import()` (preserved by electron-vite for externalized deps). If the
  import fails, the composite provider falls back to the shell provider.
- `electron-builder.yml` unpacks `**/node_modules/get-windows/**` from the asar
  so the helper binary/addon can be spawned.
- The Win/Linux native addon is ABI-bound: run `npm install` (its `postinstall`
  runs `electron-builder install-app-deps`) so it is rebuilt for Electron before
  packaging. macOS uses the prebuilt Swift CLI and needs no rebuild.

## Renderer usage

```ts
const status = await window.api.activity.start()
const today = await window.api.activity.getToday()

const off = window.api.activity.onUpdate((s) => {
  // s.currentApp, s.currentCategory, s.currentSessionMs, s.idleState, …
})
// later: off()
```
