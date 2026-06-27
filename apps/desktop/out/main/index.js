"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const promises = require("fs/promises");
const path = require("path");
const child_process = require("child_process");
const crypto = require("crypto");
const icon = path.join(__dirname, "../../resources/icon.png");
function msToIso(ms) {
  return new Date(ms).toISOString();
}
function isoToMs(iso) {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}
function appKey(sample) {
  if (sample.bundleId && sample.bundleId.length > 0) {
    return sample.bundleId.toLowerCase();
  }
  if (sample.app.length > 0) {
    return sample.app.toLowerCase();
  }
  if (sample.path.length > 0) {
    return path.basename(sample.path).toLowerCase();
  }
  return "unknown";
}
function addToMap(map, key, value) {
  map.set(key, (map.get(key) ?? 0) + value);
}
function topKey(map) {
  let best = null;
  let bestValue = -1;
  for (const [key, value] of map) {
    if (value > bestValue) {
      best = key;
      bestValue = value;
    }
  }
  return best;
}
class DailyAggregator {
  date;
  options;
  apps = /* @__PURE__ */ new Map();
  sessions = [];
  events = [];
  activeMs = 0;
  idleMs = 0;
  breakCount = 0;
  longestSessionMs = 0;
  contextSwitches = 0;
  lateNightMs = 0;
  session = null;
  inBreak = false;
  constructor(date, options, existing) {
    this.date = date;
    this.options = options;
    if (existing && existing.date === date) {
      this.restore(existing);
    }
  }
  restore(existing) {
    this.activeMs = existing.activeMs;
    this.idleMs = existing.idleMs;
    this.breakCount = existing.breakCount;
    this.longestSessionMs = existing.longestSessionMs;
    this.contextSwitches = existing.contextSwitches;
    this.lateNightMs = existing.lateNightMs;
    for (const usage of existing.appUsage) {
      this.apps.set(usage.app.toLowerCase(), {
        app: usage.app,
        category: usage.category,
        activeMs: usage.activeMs,
        focusCount: usage.focusCount,
        firstSeen: isoToMs(usage.firstSeen),
        lastSeen: isoToMs(usage.lastSeen),
        bundleId: usage.bundleId,
        path: usage.path
      });
    }
    this.sessions.push(...existing.sessions);
    this.events.push(...existing.events);
  }
  isLateNight(at) {
    const hour = new Date(at).getHours();
    const { lateNightStartHour, lateNightEndHour } = this.options;
    if (lateNightStartHour <= lateNightEndHour) {
      return hour >= lateNightStartHour && hour < lateNightEndHour;
    }
    return hour >= lateNightStartHour || hour < lateNightEndHour;
  }
  displayName(key) {
    return this.apps.get(key)?.app ?? key;
  }
  pushPersistable(event) {
    if (event.type !== "work_session.continuous" && event.type !== "activity.break") {
      return;
    }
    this.events.push(event);
    const overflow = this.events.length - this.options.maxStoredEvents;
    if (overflow > 0) {
      this.events.splice(0, overflow);
    }
  }
  startSession(at) {
    const session = {
      id: crypto.randomUUID(),
      start: at,
      lastActiveAt: at,
      activeMs: 0,
      appSwitches: 0,
      currentAppKey: null,
      appMs: /* @__PURE__ */ new Map(),
      catMs: /* @__PURE__ */ new Map(),
      lateNight: false
    };
    this.session = session;
    return session;
  }
  /** Attribute a focused interval to the given sample. */
  applyActive(sample, category, elapsedMs, at) {
    const events = [];
    const ms = Math.max(0, elapsedMs);
    if (this.inBreak) {
      this.inBreak = false;
      events.push({
        timestamp: msToIso(at),
        type: "activity.idle.end",
        source: "desktop_activity"
      });
    }
    const session = this.session ?? this.startSession(at);
    const key = appKey(sample);
    const isNewFocus = session.currentAppKey !== key;
    if (session.currentAppKey !== null && isNewFocus) {
      session.appSwitches += 1;
      this.contextSwitches += 1;
      events.push({
        timestamp: msToIso(at),
        type: "activity.app_switch",
        source: "desktop_activity",
        app: sample.app,
        appCategory: category
      });
    }
    session.currentAppKey = key;
    this.activeMs += ms;
    session.activeMs += ms;
    session.lastActiveAt = at;
    addToMap(session.appMs, key, ms);
    addToMap(session.catMs, category, ms);
    if (this.isLateNight(at)) {
      this.lateNightMs += ms;
      session.lateNight = true;
    }
    const existing = this.apps.get(key);
    const app = existing ?? {
      app: sample.app,
      category,
      activeMs: 0,
      focusCount: 0,
      firstSeen: at,
      lastSeen: at
    };
    app.activeMs += ms;
    app.lastSeen = at;
    app.category = category;
    if (isNewFocus) {
      app.focusCount += 1;
    }
    if (sample.bundleId) {
      app.bundleId = sample.bundleId;
    }
    if (sample.path) {
      app.path = sample.path;
    }
    this.apps.set(key, app);
    return events;
  }
  /** Account for an interval where the user was idle or the screen was locked. */
  applyInactive(elapsedMs, idleSeconds, at, idleState) {
    const events = [];
    this.idleMs += Math.max(0, elapsedMs);
    if (!this.session) {
      return events;
    }
    const breakMs = this.options.breakThresholdSec * 1e3;
    const idleMs = idleSeconds * 1e3;
    const locked = idleState === "locked";
    if (locked || idleMs >= breakMs) {
      const sessionEvent = this.closeOpenSession(at);
      if (sessionEvent) {
        events.push(sessionEvent);
      }
      this.breakCount += 1;
      this.inBreak = true;
      const breakEvent = {
        timestamp: msToIso(at),
        type: "activity.break",
        source: "desktop_activity",
        meta: { reason: locked ? "locked" : "idle" }
      };
      this.pushPersistable(breakEvent);
      events.push(breakEvent);
    }
    return events;
  }
  /** Finalize the open session (on break, flush or stop). Returns its event. */
  closeOpenSession(at) {
    const session = this.session;
    this.session = null;
    if (!session || session.activeMs <= 0) {
      return null;
    }
    const end = Math.max(at, session.lastActiveAt);
    const topAppKey = topKey(session.appMs);
    const topCategory = topKey(session.catMs) ?? "other";
    const topApp = topAppKey ? this.displayName(topAppKey) : "Unknown";
    const workSession = {
      id: session.id,
      start: msToIso(session.start),
      end: msToIso(end),
      activeMs: session.activeMs,
      appSwitches: session.appSwitches,
      topApp,
      topCategory,
      lateNight: session.lateNight
    };
    this.sessions.push(workSession);
    this.longestSessionMs = Math.max(this.longestSessionMs, session.activeMs);
    const event = {
      timestamp: workSession.end,
      type: "work_session.continuous",
      source: "desktop_activity",
      durationMinutes: Math.round(session.activeMs / 6e4),
      appCategory: topCategory,
      app: topApp,
      meta: { appSwitches: session.appSwitches, lateNight: session.lateNight }
    };
    this.pushPersistable(event);
    return event;
  }
  /** Focused milliseconds of the currently open session. */
  currentSessionMs() {
    return this.session?.activeMs ?? 0;
  }
  hasOpenSession() {
    return this.session !== null;
  }
  snapshot() {
    const appUsage = [...this.apps.values()].map((state) => ({
      app: state.app,
      category: state.category,
      activeMs: state.activeMs,
      focusCount: state.focusCount,
      firstSeen: msToIso(state.firstSeen),
      lastSeen: msToIso(state.lastSeen),
      bundleId: state.bundleId,
      path: state.path
    })).sort((a, b) => b.activeMs - a.activeMs);
    return {
      date: this.date,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      source: "desktop_activity",
      activeMs: this.activeMs,
      idleMs: this.idleMs,
      breakCount: this.breakCount,
      longestSessionMs: this.longestSessionMs,
      contextSwitches: this.contextSwitches,
      lateNightMs: this.lateNightMs,
      appUsage,
      sessions: [...this.sessions],
      events: [...this.events]
    };
  }
}
const RULES = [
  {
    category: "coding",
    keywords: [
      "code",
      "vscode",
      "visual studio",
      "intellij",
      "webstorm",
      "pycharm",
      "phpstorm",
      "goland",
      "rubymine",
      "clion",
      "rider",
      "android studio",
      "xcode",
      "sublime",
      "sublime text",
      "atom",
      "neovim",
      "nvim",
      "vim",
      "emacs",
      "iterm",
      "terminal",
      "warp",
      "hyper",
      "tabby",
      "kitty",
      "alacritty",
      "wezterm",
      "konsole",
      "gnome-terminal",
      "powershell",
      "pwsh",
      "cmd",
      "windowsterminal",
      "fleet",
      "zed",
      "cursor",
      "docker",
      "postman",
      "insomnia",
      "datagrip",
      "tableplus",
      "sourcetree",
      "github desktop",
      "gitkraken"
    ]
  },
  {
    category: "meeting",
    keywords: [
      "zoom",
      "webex",
      "gotomeeting",
      "bluejeans",
      "google meet",
      "whereby",
      "around"
    ]
  },
  {
    category: "communication",
    keywords: [
      "slack",
      "discord",
      "mattermost",
      "telegram",
      "whatsapp",
      "messenger",
      "signal",
      "teams",
      "skype",
      "outlook",
      "mail",
      "thunderbird",
      "gmail",
      "spark",
      "zalo"
    ]
  },
  {
    category: "writing",
    keywords: [
      "word",
      "pages",
      "notion",
      "obsidian",
      "bear",
      "typora",
      "onenote",
      "evernote",
      "google docs",
      "logseq",
      "craft",
      "ulysses",
      "scrivener",
      "ia writer"
    ]
  },
  {
    category: "design",
    keywords: [
      "figma",
      "sketch",
      "photoshop",
      "illustrator",
      "indesign",
      "adobe xd",
      "affinity",
      "canva",
      "blender",
      "gimp",
      "inkscape",
      "lightroom",
      "premiere",
      "after effects",
      "davinci resolve"
    ]
  },
  {
    category: "browsing",
    keywords: [
      "chrome",
      "chromium",
      "firefox",
      "safari",
      "edge",
      "brave",
      "opera",
      "vivaldi",
      "arc",
      "tor browser"
    ]
  },
  {
    category: "support",
    keywords: [
      "zendesk",
      "freshdesk",
      "intercom",
      "jira",
      "servicenow",
      "helpscout",
      "front",
      "gorgias",
      "kustomer"
    ]
  },
  {
    category: "media",
    keywords: [
      "spotify",
      "youtube",
      "netflix",
      "vlc",
      "music",
      "apple music",
      "quicktime",
      "twitch",
      "soundcloud",
      "podcast"
    ]
  },
  {
    category: "productivity",
    keywords: [
      "excel",
      "numbers",
      "powerpoint",
      "keynote",
      "google sheets",
      "google slides",
      "trello",
      "asana",
      "clickup",
      "todoist",
      "things",
      "calendar",
      "fantastical",
      "linear",
      "monday"
    ]
  },
  {
    category: "system",
    keywords: [
      "finder",
      "explorer",
      "system settings",
      "system preferences",
      "settings",
      "activity monitor",
      "task manager",
      "control panel",
      "installer",
      "loginwindow",
      "dock",
      "systemuiserver",
      "spotlight",
      "screenshot"
    ]
  }
];
function buildHaystack(sample) {
  const parts = [sample.app, sample.bundleId ?? "", sample.path ? path.basename(sample.path) : ""];
  return parts.join(" ").toLowerCase();
}
function categorize(sample, overrides = {}) {
  const override = overrides[sample.app.toLowerCase()];
  if (override) {
    return override;
  }
  const haystack = buildHaystack(sample);
  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword)) {
        return rule.category;
      }
    }
  }
  return "other";
}
function getIdleSeconds() {
  return electron.powerMonitor.getSystemIdleTime();
}
function getIdleState(thresholdSec) {
  const state = electron.powerMonitor.getSystemIdleState(Math.max(1, Math.round(thresholdSec)));
  if (state === "active" || state === "idle" || state === "locked") {
    return state;
  }
  return "unknown";
}
let modulePromise = null;
function loadModule() {
  if (!modulePromise) {
    modulePromise = import("get-windows");
  }
  return modulePromise;
}
function toSample(result) {
  const sample = {
    app: result.owner.name,
    title: result.title,
    pid: result.owner.processId,
    path: result.owner.path,
    platform: result.platform,
    windowId: result.id
  };
  if (result.platform === "macos") {
    sample.bundleId = result.owner.bundleId;
    if (typeof result.url === "string" && result.url.length > 0) {
      sample.url = result.url;
    }
  }
  return sample;
}
function createGetWindowsProvider() {
  return {
    name: "get-windows",
    async isAvailable() {
      try {
        const mod = await loadModule();
        return typeof mod.activeWindow === "function";
      } catch {
        modulePromise = null;
        return false;
      }
    },
    async getActiveWindow(options) {
      const mod = await loadModule();
      const result = await mod.activeWindow({
        accessibilityPermission: options.captureUrls,
        screenRecordingPermission: options.captureTitles
      });
      if (!result) {
        return null;
      }
      return toSample(result);
    }
  };
}
const RUN_TIMEOUT_MS = 4e3;
const MAX_BUFFER$1 = 1024 * 1024;
function run$1(command, args) {
  return new Promise((resolve, reject) => {
    child_process.execFile(
      command,
      args,
      { timeout: RUN_TIMEOUT_MS, maxBuffer: MAX_BUFFER$1, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}
async function commandExists$1(command) {
  const locator = process.platform === "win32" ? "where" : "which";
  try {
    await run$1(locator, [command]);
    return true;
  } catch {
    return false;
  }
}
function parsePid(value) {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
async function macProcessPath(pid) {
  if (pid <= 0) {
    return "";
  }
  try {
    const { stdout } = await run$1("ps", ["-p", String(pid), "-o", "comm="]);
    return stdout.trim();
  } catch {
    return "";
  }
}
async function sampleMac(options) {
  const titleScript = options.captureTitles ? '\n  set winTitle to ""\n  try\n    set winTitle to name of front window of frontApp\n  end try' : '\n  set winTitle to ""';
  const script = 'tell application "System Events"\n  set frontApp to first application process whose frontmost is true\n  set appName to name of frontApp\n  set appPid to unix id of frontApp' + titleScript + '\nend tell\nreturn appName & "\\n" & appPid & "\\n" & winTitle';
  let stdout;
  try {
    const result = await run$1("osascript", ["-e", script]);
    stdout = result.stdout;
  } catch {
    return null;
  }
  const lines = stdout.split("\n");
  const app = (lines[0] ?? "").trim();
  if (app.length === 0) {
    return null;
  }
  const pid = parsePid(lines[1]);
  const title = options.captureTitles ? (lines[2] ?? "").trim() : "";
  const path2 = await macProcessPath(pid);
  return {
    app,
    title,
    pid,
    path: path2,
    platform: "macos",
    windowId: 0
  };
}
const WINDOWS_SCRIPT = [
  '$ErrorActionPreference = "SilentlyContinue"',
  'Add-Type @"',
  "using System;",
  "using System.Runtime.InteropServices;",
  "public class DeskMateWin {",
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);',
  "}",
  '"@',
  "$handle = [DeskMateWin]::GetForegroundWindow()",
  "$procId = 0",
  "[void][DeskMateWin]::GetWindowThreadProcessId($handle, [ref]$procId)",
  "$proc = Get-Process -Id $procId",
  "$fields = @($procId, $proc.ProcessName, $proc.Path, $proc.MainWindowTitle, [int64]$handle)",
  '$fields -join "`n"'
].join("\n");
async function sampleWindows(options) {
  const encoded = Buffer.from(WINDOWS_SCRIPT, "utf16le").toString("base64");
  let stdout;
  try {
    const result = await run$1("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encoded
    ]);
    stdout = result.stdout;
  } catch {
    return null;
  }
  const lines = stdout.split("\n").map((line) => line.replace(/\r$/, ""));
  const pid = parsePid(lines[0]);
  const processName = (lines[1] ?? "").trim();
  const path$1 = (lines[2] ?? "").trim();
  const title = options.captureTitles ? (lines[3] ?? "").trim() : "";
  const windowId = parsePid(lines[4]);
  const app = processName.length > 0 ? processName : path$1.length > 0 ? path.basename(path$1) : "";
  if (app.length === 0) {
    return null;
  }
  return {
    app,
    title,
    pid,
    path: path$1,
    platform: "windows",
    windowId
  };
}
async function readProcComm(pid) {
  if (pid <= 0) {
    return "";
  }
  try {
    const raw = await promises.readFile(`/proc/${pid}/comm`, "utf8");
    return raw.trim();
  } catch {
    return "";
  }
}
async function readProcExe(pid) {
  if (pid <= 0) {
    return "";
  }
  try {
    return await promises.readlink(`/proc/${pid}/exe`);
  } catch {
    return "";
  }
}
function extractXpropString(output, property) {
  const line = output.split("\n").find((entry) => entry.startsWith(property));
  if (!line) {
    return "";
  }
  const eq = line.indexOf("=");
  if (eq < 0) {
    return "";
  }
  const value = line.slice(eq + 1).trim();
  const quoted = value.match(/"([^"]*)"/g);
  if (quoted && quoted.length > 0) {
    const last = quoted[quoted.length - 1];
    return last.replace(/"/g, "");
  }
  return value;
}
function extractXpropNumber(output, property) {
  const line = output.split("\n").find((entry) => entry.startsWith(property));
  if (!line) {
    return 0;
  }
  const match = line.match(/=\s*(\d+)/);
  return match ? parsePid(match[1]) : 0;
}
async function sampleLinuxXdotool(options) {
  let stdout;
  try {
    const result = await run$1("xdotool", [
      "getactivewindow",
      "getwindowpid",
      "getwindowname"
    ]);
    stdout = result.stdout;
  } catch {
    return null;
  }
  const lines = stdout.split("\n");
  const pid = parsePid(lines[0]);
  const windowName = (lines[1] ?? "").trim();
  const comm = await readProcComm(pid);
  const exePath = await readProcExe(pid);
  const app = comm.length > 0 ? comm : windowName;
  if (app.length === 0) {
    return null;
  }
  return {
    app,
    title: options.captureTitles ? windowName : "",
    pid,
    path: exePath,
    platform: "linux",
    windowId: 0
  };
}
async function sampleLinuxXprop(options) {
  let activeOut;
  try {
    const result = await run$1("xprop", ["-root", "_NET_ACTIVE_WINDOW"]);
    activeOut = result.stdout;
  } catch {
    return null;
  }
  const idMatch = activeOut.match(/0x[0-9a-fA-F]+/);
  if (!idMatch) {
    return null;
  }
  const windowIdHex = idMatch[0];
  const windowId = Number.parseInt(windowIdHex, 16);
  let infoOut;
  try {
    const result = await run$1("xprop", [
      "-id",
      windowIdHex,
      "_NET_WM_PID",
      "WM_CLASS",
      "_NET_WM_NAME"
    ]);
    infoOut = result.stdout;
  } catch {
    return null;
  }
  const pid = extractXpropNumber(infoOut, "_NET_WM_PID");
  const wmClass = extractXpropString(infoOut, "WM_CLASS");
  const title = extractXpropString(infoOut, "_NET_WM_NAME");
  const comm = await readProcComm(pid);
  const exePath = await readProcExe(pid);
  const app = wmClass.length > 0 ? wmClass : comm;
  if (app.length === 0) {
    return null;
  }
  return {
    app,
    title: options.captureTitles ? title : "",
    pid,
    path: exePath,
    platform: "linux",
    windowId: Number.isFinite(windowId) ? windowId : 0
  };
}
async function sampleLinux(options) {
  if (await commandExists$1("xdotool")) {
    const sample = await sampleLinuxXdotool(options);
    if (sample) {
      return sample;
    }
  }
  if (await commandExists$1("xprop")) {
    return sampleLinuxXprop(options);
  }
  return null;
}
function createShellProvider() {
  return {
    name: `shell:${process.platform}`,
    async isAvailable() {
      if (process.platform === "darwin") {
        return commandExists$1("osascript");
      }
      if (process.platform === "win32") {
        return commandExists$1("powershell.exe");
      }
      if (process.platform === "linux") {
        const hasDisplay = Boolean(process.env.DISPLAY);
        if (!hasDisplay) {
          return false;
        }
        return await commandExists$1("xdotool") || await commandExists$1("xprop");
      }
      return false;
    },
    getActiveWindow(options) {
      if (process.platform === "darwin") {
        return sampleMac(options);
      }
      if (process.platform === "win32") {
        return sampleWindows(options);
      }
      if (process.platform === "linux") {
        return sampleLinux(options);
      }
      return Promise.resolve(null);
    }
  };
}
const FAILURE_LIMIT = 3;
function createCompositeProvider() {
  const candidates = [createGetWindowsProvider(), createShellProvider()];
  let active = null;
  let failures = 0;
  async function ensureActive() {
    if (active) {
      return active;
    }
    for (const candidate of candidates) {
      if (await candidate.isAvailable()) {
        active = candidate;
        failures = 0;
        return active;
      }
    }
    return null;
  }
  function demote(provider) {
    const index = candidates.indexOf(provider);
    if (index >= 0 && candidates.length > 1) {
      candidates.splice(index, 1);
      candidates.push(provider);
    }
    active = null;
    failures = 0;
  }
  return {
    name: "composite",
    activeName() {
      return active ? active.name : null;
    },
    async isAvailable() {
      return await ensureActive() !== null;
    },
    async getActiveWindow(options) {
      const provider = await ensureActive();
      if (!provider) {
        return null;
      }
      try {
        const sample = await provider.getActiveWindow(options);
        failures = 0;
        return sample;
      } catch {
        failures += 1;
        if (failures >= FAILURE_LIMIT) {
          demote(provider);
        }
        return null;
      }
    }
  };
}
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function activityDir() {
  return path.join(electron.app.getPath("userData"), "activity");
}
function dayFile(date) {
  return path.join(activityDir(), `${date}.json`);
}
function isDailyUsage(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = { ...value };
  return typeof record.date === "string" && typeof record.activeMs === "number" && typeof record.idleMs === "number" && Array.isArray(record.appUsage) && Array.isArray(record.sessions) && Array.isArray(record.events);
}
async function loadDay(date) {
  try {
    const raw = await promises.readFile(dayFile(date), "utf8");
    const parsed = JSON.parse(raw);
    return isDailyUsage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
async function saveDay(usage) {
  await promises.mkdir(activityDir(), { recursive: true });
  const target = dayFile(usage.date);
  const temp = `${target}.${process.pid}.tmp`;
  await promises.writeFile(temp, JSON.stringify(usage, null, 2), "utf8");
  await promises.rename(temp, target);
}
async function listDays() {
  try {
    const entries = await promises.readdir(activityDir());
    const dates = entries.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length)).filter((name) => DATE_PATTERN.test(name));
    dates.sort((a, b) => b.localeCompare(a));
    return dates;
  } catch {
    return [];
  }
}
function localDateKey(at) {
  const date = new Date(at);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function endOfLocalDayMs(at) {
  const date = new Date(at);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}
const DEFAULT_TRACKER_OPTIONS = {
  pollIntervalMs: 4e3,
  idleThresholdSec: 60,
  breakThresholdSec: 300,
  captureTitles: false,
  captureUrls: false,
  lateNightStartHour: 22,
  lateNightEndHour: 5,
  persist: true,
  categoryOverrides: {},
  maxStoredEvents: 500
};
const MAC_EPOCH_OFFSET_SEC = 978307200;
const EXEC_TIMEOUT_MS = 2e4;
const MAX_BUFFER = 32 * 1024 * 1024;
const DEFAULT_MAX_DAYS = 30;
function run(command, args) {
  return new Promise((resolve, reject) => {
    child_process.execFile(
      command,
      args,
      { timeout: EXEC_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      }
    );
  });
}
function errnoCode(error) {
  if (error instanceof Error && "code" in error) {
    const code = Reflect.get(error, "code");
    return typeof code === "string" ? code : "";
  }
  return "";
}
async function commandExists(command) {
  try {
    await run("which", [command]);
    return true;
  } catch {
    return false;
  }
}
function knowledgeDbPath() {
  return path.join(electron.app.getPath("home"), "Library", "Application Support", "Knowledge", "knowledgeC.db");
}
function bundleToName(bundle) {
  const parts = bundle.split(".");
  const last = parts[parts.length - 1] || bundle;
  return last.charAt(0).toUpperCase() + last.slice(1);
}
function bundleToSample(bundle) {
  return {
    app: bundleToName(bundle),
    title: "",
    pid: 0,
    path: "",
    platform: "macos",
    windowId: 0,
    bundleId: bundle
  };
}
const USAGE_QUERY = "SELECT ZVALUESTRING, ZSTARTDATE, ZENDDATE FROM ZOBJECT WHERE ZSTREAMNAME = '/app/usage' AND ZVALUESTRING IS NOT NULL AND ZENDDATE > ZSTARTDATE ORDER BY ZSTARTDATE";
function parseIntervals(stdout, cutoffMs) {
  const intervals = [];
  for (const line of stdout.split("\n")) {
    if (line.length === 0) {
      continue;
    }
    const parts = line.split("	");
    if (parts.length < 3) {
      continue;
    }
    const bundle = parts[0];
    const start = Number.parseFloat(parts[1]);
    const end = Number.parseFloat(parts[2]);
    if (bundle.length === 0 || !Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }
    const startMs = (start + MAC_EPOCH_OFFSET_SEC) * 1e3;
    const endMs = (end + MAC_EPOCH_OFFSET_SEC) * 1e3;
    if (endMs <= startMs || endMs < cutoffMs) {
      continue;
    }
    intervals.push({ bundle, startMs, endMs });
  }
  return intervals;
}
function splitByDay(interval) {
  const segments = [];
  let cursor = interval.startMs;
  while (cursor < interval.endMs) {
    const dayEnd = endOfLocalDayMs(cursor);
    const nextDayStart = dayEnd + 1;
    const segmentEnd = Math.min(interval.endMs, nextDayStart);
    segments.push({ bundle: interval.bundle, startMs: cursor, endMs: segmentEnd });
    cursor = nextDayStart;
  }
  return segments;
}
function aggregatorOptions(config) {
  return {
    ...DEFAULT_TRACKER_OPTIONS,
    breakThresholdSec: config.breakThresholdSec,
    lateNightStartHour: config.lateNightStartHour,
    lateNightEndHour: config.lateNightEndHour,
    categoryOverrides: config.categoryOverrides,
    maxStoredEvents: config.maxStoredEvents
  };
}
function buildDay(date, segments, config) {
  const options = aggregatorOptions(config);
  const aggregator = new DailyAggregator(date, options);
  const breakMs = config.breakThresholdSec * 1e3;
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  let lastEnd = null;
  for (const segment of sorted) {
    if (lastEnd !== null) {
      const gap = segment.startMs - lastEnd;
      if (gap > 0) {
        const state = gap >= breakMs ? "idle" : "active";
        aggregator.applyInactive(0, gap / 1e3, segment.startMs, state);
      }
    }
    const sample = bundleToSample(segment.bundle);
    const category = categorize(sample, config.categoryOverrides);
    aggregator.applyActive(sample, category, segment.endMs - segment.startMs, segment.endMs);
    lastEnd = segment.endMs;
  }
  aggregator.closeOpenSession(lastEnd ?? Date.now());
  const usage = aggregator.snapshot();
  usage.source = "screen_time_import";
  usage.events = usage.events.map((event) => ({ ...event, source: "screen_time_import" }));
  return usage;
}
function failure(supported, permissionRequired, error) {
  return {
    supported,
    permissionRequired,
    importedDays: [],
    skippedDays: [],
    totalIntervals: 0,
    rangeStart: null,
    rangeEnd: null,
    source: "screen_time",
    error
  };
}
function isScreenTimeBackfillSupported() {
  return process.platform === "darwin";
}
async function openScreenTimePermission() {
  if (process.platform !== "darwin") {
    return;
  }
  await electron.shell.openExternal(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
  );
}
async function importMacScreenTime(partial = {}) {
  if (process.platform !== "darwin") {
    return failure(false, false, "Screen Time backfill is only available on macOS.");
  }
  const config = {
    breakThresholdSec: partial.breakThresholdSec ?? DEFAULT_TRACKER_OPTIONS.breakThresholdSec,
    lateNightStartHour: partial.lateNightStartHour ?? DEFAULT_TRACKER_OPTIONS.lateNightStartHour,
    lateNightEndHour: partial.lateNightEndHour ?? DEFAULT_TRACKER_OPTIONS.lateNightEndHour,
    categoryOverrides: partial.categoryOverrides ?? {},
    maxStoredEvents: partial.maxStoredEvents ?? DEFAULT_TRACKER_OPTIONS.maxStoredEvents,
    maxDays: partial.maxDays ?? DEFAULT_MAX_DAYS,
    overwrite: partial.overwrite ?? false,
    skipDates: partial.skipDates ?? []
  };
  if (!await commandExists("sqlite3")) {
    return failure(true, false, "The sqlite3 command was not found on this system.");
  }
  const source = knowledgeDbPath();
  const tempBase = path.join(electron.app.getPath("temp"), `deskmate-knowledgeC-${process.pid}-${Date.now()}.db`);
  const tempFiles = [tempBase, `${tempBase}-wal`, `${tempBase}-shm`];
  try {
    await promises.copyFile(source, tempBase);
  } catch (error) {
    const code = errnoCode(error);
    if (code === "ENOENT") {
      return failure(true, false, "No Screen Time database found (knowledgeC.db is missing).");
    }
    if (code === "EPERM" || code === "EACCES") {
      return failure(true, true, "Full Disk Access is required to read Screen Time data.");
    }
    return failure(true, false, `Could not read Screen Time data: ${code || "unknown error"}.`);
  }
  await promises.copyFile(`${source}-wal`, `${tempBase}-wal`).catch(() => void 0);
  await promises.copyFile(`${source}-shm`, `${tempBase}-shm`).catch(() => void 0);
  try {
    const stdout = await run("sqlite3", ["-readonly", "-separator", "	", tempBase, USAGE_QUERY]);
    const cutoffMs = Date.now() - config.maxDays * 24 * 60 * 60 * 1e3;
    const intervals = parseIntervals(stdout, cutoffMs);
    const byDay = /* @__PURE__ */ new Map();
    for (const interval of intervals) {
      for (const segment of splitByDay(interval)) {
        const bucket = byDay.get(localDateKey(segment.startMs));
        if (bucket) {
          bucket.push(segment);
        } else {
          byDay.set(localDateKey(segment.startMs), [segment]);
        }
      }
    }
    const allDays = [...byDay.keys()].sort();
    const importedDays = [];
    const skippedDays = [];
    for (const date of allDays) {
      if (config.skipDates.includes(date)) {
        skippedDays.push(date);
        continue;
      }
      if (!config.overwrite && await loadDay(date) !== null) {
        skippedDays.push(date);
        continue;
      }
      const segments = byDay.get(date) ?? [];
      await saveDay(buildDay(date, segments, config));
      importedDays.push(date);
    }
    return {
      supported: true,
      permissionRequired: false,
      importedDays,
      skippedDays,
      totalIntervals: intervals.length,
      rangeStart: allDays[0] ?? null,
      rangeEnd: allDays[allDays.length - 1] ?? null,
      source: "screen_time",
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return failure(true, false, `Failed to query Screen Time data: ${message}.`);
  } finally {
    await Promise.all(tempFiles.map((file) => promises.unlink(file).catch(() => void 0)));
  }
}
const PERSIST_INTERVAL_MS = 15e3;
class Emitter {
  handlers = /* @__PURE__ */ new Set();
  on(handler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
  emit(payload) {
    for (const handler of this.handlers) {
      handler(payload);
    }
  }
  clear() {
    this.handlers.clear();
  }
}
class ActivityTrackerImpl {
  options;
  queryOptions;
  provider = createCompositeProvider();
  updateEmitter = new Emitter();
  eventEmitter = new Emitter();
  aggregator;
  timer = null;
  running = false;
  lastTick = Date.now();
  lastPersistAt = 0;
  dirty = false;
  lastSample = null;
  lastCategory = null;
  lastSampleAt = null;
  idleState = "unknown";
  handleAway = () => {
    const now = Date.now();
    const events = this.aggregator.applyInactive(
      0,
      this.options.breakThresholdSec + 1,
      now,
      "locked"
    );
    for (const event of events) {
      this.eventEmitter.emit(event);
    }
    this.idleState = "locked";
    this.dirty = true;
    void this.persist(true);
  };
  handleResume = () => {
    this.lastTick = Date.now();
  };
  constructor(options) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options };
    this.queryOptions = {
      captureTitles: this.options.captureTitles,
      captureUrls: this.options.captureUrls
    };
    this.aggregator = new DailyAggregator(localDateKey(Date.now()), this.options);
  }
  async start() {
    if (this.running) {
      return this.getStatus();
    }
    const today = localDateKey(Date.now());
    const existing = await loadDay(today);
    this.aggregator = new DailyAggregator(today, this.options, existing);
    await this.provider.isAvailable();
    this.running = true;
    this.lastTick = Date.now();
    this.lastPersistAt = Date.now();
    this.addPowerListeners();
    this.scheduleNext(0);
    return this.getStatus();
  }
  async stop() {
    if (!this.running) {
      return this.getStatus();
    }
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.removePowerListeners();
    this.aggregator.closeOpenSession(Date.now());
    await this.persist(true);
    const status = this.getStatus();
    this.updateEmitter.emit(status);
    return status;
  }
  getStatus() {
    return {
      running: this.running,
      providerName: this.provider.activeName(),
      idleState: this.idleState,
      currentApp: this.lastSample?.app ?? null,
      currentCategory: this.lastCategory,
      currentSessionMs: this.aggregator.currentSessionMs(),
      lastSampleAt: this.lastSampleAt ? new Date(this.lastSampleAt).toISOString() : null,
      date: this.aggregator.date
    };
  }
  getToday() {
    return this.aggregator.snapshot();
  }
  async getDay(date) {
    if (date === this.aggregator.date) {
      return this.aggregator.snapshot();
    }
    return loadDay(date);
  }
  listDays() {
    return listDays();
  }
  isBackfillSupported() {
    return isScreenTimeBackfillSupported();
  }
  openHistoryPermission() {
    return openScreenTimePermission();
  }
  backfill(options) {
    return importMacScreenTime({
      breakThresholdSec: this.options.breakThresholdSec,
      lateNightStartHour: this.options.lateNightStartHour,
      lateNightEndHour: this.options.lateNightEndHour,
      categoryOverrides: this.options.categoryOverrides,
      maxStoredEvents: this.options.maxStoredEvents,
      // Never overwrite the live current day.
      skipDates: [this.aggregator.date],
      ...options
    });
  }
  onUpdate(handler) {
    return this.updateEmitter.on(handler);
  }
  onEvent(handler) {
    return this.eventEmitter.on(handler);
  }
  flush() {
    return this.persist(true);
  }
  async dispose() {
    await this.stop();
    this.updateEmitter.clear();
    this.eventEmitter.clear();
  }
  scheduleNext(delayMs) {
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }
  async tick() {
    if (!this.running) {
      return;
    }
    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;
    const today = localDateKey(now);
    if (today !== this.aggregator.date) {
      await this.rollover(today);
    }
    const capped = Math.min(Math.max(elapsed, 0), this.options.pollIntervalMs * 3);
    const idleSeconds = getIdleSeconds();
    const idleState = getIdleState(this.options.idleThresholdSec);
    this.idleState = idleState;
    let events = [];
    if (idleState === "active") {
      const sample = await this.safeSample();
      if (sample) {
        const category = categorize(sample, this.options.categoryOverrides);
        this.lastSample = sample;
        this.lastCategory = category;
        this.lastSampleAt = now;
        events = this.aggregator.applyActive(sample, category, capped, now);
      } else {
        events = this.aggregator.applyInactive(capped, idleSeconds, now, "unknown");
      }
    } else {
      events = this.aggregator.applyInactive(capped, idleSeconds, now, idleState);
    }
    this.dirty = true;
    for (const event of events) {
      this.eventEmitter.emit(event);
    }
    if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      await this.persist(false);
    }
    this.updateEmitter.emit(this.getStatus());
    if (this.running) {
      this.scheduleNext(this.options.pollIntervalMs);
    }
  }
  async safeSample() {
    try {
      return await this.provider.getActiveWindow(this.queryOptions);
    } catch {
      return null;
    }
  }
  async rollover(newDate) {
    this.aggregator.closeOpenSession(Date.now());
    await this.persist(true);
    const existing = await loadDay(newDate);
    this.aggregator = new DailyAggregator(newDate, this.options, existing);
    this.lastSample = null;
    this.lastCategory = null;
  }
  async persist(force) {
    if (!this.options.persist) {
      return;
    }
    if (!force && !this.dirty) {
      return;
    }
    this.lastPersistAt = Date.now();
    this.dirty = false;
    try {
      await saveDay(this.aggregator.snapshot());
    } catch {
      this.dirty = true;
    }
  }
  addPowerListeners() {
    electron.powerMonitor.on("suspend", this.handleAway);
    electron.powerMonitor.on("lock-screen", this.handleAway);
    electron.powerMonitor.on("resume", this.handleResume);
    electron.powerMonitor.on("unlock-screen", this.handleResume);
  }
  removePowerListeners() {
    electron.powerMonitor.removeListener("suspend", this.handleAway);
    electron.powerMonitor.removeListener("lock-screen", this.handleAway);
    electron.powerMonitor.removeListener("resume", this.handleResume);
    electron.powerMonitor.removeListener("unlock-screen", this.handleResume);
  }
}
function createActivityTracker(options) {
  return new ActivityTrackerImpl(options);
}
const ACTIVITY_CHANNELS = {
  // renderer → main (invoke)
  start: "activity:start",
  stop: "activity:stop",
  status: "activity:status",
  getToday: "activity:get-today",
  getDay: "activity:get-day",
  listDays: "activity:list-days",
  backfill: "activity:backfill",
  backfillSupport: "activity:backfill-support",
  openPermission: "activity:open-permission",
  // main → renderer (send)
  update: "activity:update",
  event: "activity:event"
};
function toBackfillOptions(value) {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const options = {};
  const maxDays = Reflect.get(value, "maxDays");
  if (typeof maxDays === "number") {
    options.maxDays = maxDays;
  }
  const overwrite = Reflect.get(value, "overwrite");
  if (typeof overwrite === "boolean") {
    options.overwrite = overwrite;
  }
  return options;
}
function registerActivityIpc(ipcMain, tracker, getWindows) {
  const broadcast = (channel, payload) => {
    for (const window of getWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, payload);
      }
    }
  };
  ipcMain.handle(ACTIVITY_CHANNELS.start, () => tracker.start());
  ipcMain.handle(ACTIVITY_CHANNELS.stop, () => tracker.stop());
  ipcMain.handle(ACTIVITY_CHANNELS.status, () => tracker.getStatus());
  ipcMain.handle(ACTIVITY_CHANNELS.getToday, () => tracker.getToday());
  ipcMain.handle(ACTIVITY_CHANNELS.listDays, () => tracker.listDays());
  ipcMain.handle(ACTIVITY_CHANNELS.backfillSupport, () => tracker.isBackfillSupported());
  ipcMain.handle(ACTIVITY_CHANNELS.openPermission, () => tracker.openHistoryPermission());
  ipcMain.handle(
    ACTIVITY_CHANNELS.backfill,
    (_event, optionsArg) => tracker.backfill(toBackfillOptions(optionsArg))
  );
  ipcMain.handle(
    ACTIVITY_CHANNELS.getDay,
    (_event, dateArg) => {
      if (typeof dateArg === "string") {
        return tracker.getDay(dateArg);
      }
      return Promise.resolve(tracker.getToday());
    }
  );
  const offUpdate = tracker.onUpdate((status) => broadcast(ACTIVITY_CHANNELS.update, status));
  const offEvent = tracker.onEvent((event) => broadcast(ACTIVITY_CHANNELS.event, event));
  return () => {
    offUpdate();
    offEvent();
    ipcMain.removeHandler(ACTIVITY_CHANNELS.start);
    ipcMain.removeHandler(ACTIVITY_CHANNELS.stop);
    ipcMain.removeHandler(ACTIVITY_CHANNELS.status);
    ipcMain.removeHandler(ACTIVITY_CHANNELS.getToday);
    ipcMain.removeHandler(ACTIVITY_CHANNELS.listDays);
    ipcMain.removeHandler(ACTIVITY_CHANNELS.getDay);
    ipcMain.removeHandler(ACTIVITY_CHANNELS.backfill);
    ipcMain.removeHandler(ACTIVITY_CHANNELS.backfillSupport);
    ipcMain.removeHandler(ACTIVITY_CHANNELS.openPermission);
  };
}
const CHAT_CHANNELS = {
  sendMascotMessage: "chat:mascot:send-message"
};
const DEFAULT_DESKMATE_API_BASE_URL = "http://127.0.0.1:8000";
async function sendMascotChatMessage(request, context) {
  const baseURL = getChatBaseUrl();
  const response = await fetch(`${baseURL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildChatApiRequest(request, context))
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(buildHttpErrorMessage(response.status, responseText));
  }
  const parsedResponse = parseJsonResponse(responseText);
  const chatResponse = parseDeskMateChatApiResponse(parsedResponse);
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  return {
    message: chatResponse.answer,
    motion: chatResponse.used_llm ? "happy" : "liked",
    createdAt
  };
}
function getChatBaseUrl() {
  const baseURL = process.env["DESKMATE_CHAT_BASE_URL"]?.trim() || process.env["DESKMATE_LOCAL_CHAT_BASE_URL"]?.trim() || DEFAULT_DESKMATE_API_BASE_URL;
  return baseURL.replace(/\/+$/, "");
}
function buildChatApiRequest(request, context) {
  const history = request.history?.map((message) => ({
    role: message.role,
    content: message.content
  }));
  if (!context) {
    return { question: request.message, history };
  }
  return {
    question: request.message,
    history,
    context: {
      active_time: context.activeTime,
      longest_session: context.longestSession,
      current_session_minutes: context.currentSessionMinutes,
      break_count: context.breakCount,
      extra_events: context.extraEvents
    }
  };
}
function buildHttpErrorMessage(status, responseText) {
  const trimmedResponseText = responseText.trim();
  if (trimmedResponseText.length === 0) {
    return `Mascot chat request failed with status ${status}`;
  }
  return `Mascot chat request failed with status ${status}: ${trimmedResponseText}`;
}
function parseJsonResponse(responseText) {
  if (responseText.trim().length === 0) {
    throw new Error("Mascot chat response was empty");
  }
  const parsed = JSON.parse(responseText);
  return parsed;
}
function parseDeskMateChatApiResponse(value) {
  if (!isRecord(value)) {
    throw new Error("DeskMate chat response shape is invalid.");
  }
  if (typeof value.answer !== "string" || typeof value.used_llm !== "boolean" || !Array.isArray(value.retrieved_documents)) {
    throw new Error("DeskMate chat response shape is invalid.");
  }
  return {
    answer: value.answer,
    used_llm: value.used_llm,
    retrieved_documents: value.retrieved_documents.map(parseRetrievedDocument)
  };
}
function parseRetrievedDocument(value) {
  if (!isRecord(value)) {
    throw new Error("Retrieved document response shape is invalid.");
  }
  if (typeof value.source !== "string" || typeof value.title !== "string" || typeof value.content !== "string" || typeof value.score !== "number") {
    throw new Error("Retrieved document response shape is invalid.");
  }
  return {
    source: value.source,
    title: value.title,
    content: value.content,
    score: value.score
  };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const MS_PER_MINUTE = 6e4;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
function toMascotChatRequest(value) {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const message = Reflect.get(value, "message");
  if (typeof message !== "string") {
    return null;
  }
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }
  return { message: trimmed, history: toMascotChatHistory(Reflect.get(value, "history")) };
}
function toMascotChatHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const messages = [];
  for (const item of value.slice(-8)) {
    const message = toMascotChatHistoryMessage(item);
    if (message) {
      messages.push(message);
    }
  }
  return messages;
}
function toMascotChatHistoryMessage(value) {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const role = Reflect.get(value, "role");
  const content = Reflect.get(value, "content");
  if (role !== "user" && role !== "assistant" || typeof content !== "string") {
    return null;
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }
  return { role, content: trimmed };
}
function registerChatIpc(ipcMain, activityTracker2) {
  ipcMain.handle(
    CHAT_CHANNELS.sendMascotMessage,
    async (_event, requestArg) => {
      const request = toMascotChatRequest(requestArg);
      if (!request) {
        throw new Error("Message is required");
      }
      return sendMascotChatMessage(request, buildMascotChatContext(activityTracker2));
    }
  );
  return () => {
    ipcMain.removeHandler(CHAT_CHANNELS.sendMascotMessage);
  };
}
function buildMascotChatContext(activityTracker2) {
  const status = activityTracker2.getStatus();
  const today = activityTracker2.getToday();
  const longestSessionMinutes = Math.round(today.longestSessionMs / MS_PER_MINUTE);
  const currentSessionMinutes = Math.round(status.currentSessionMs / MS_PER_MINUTE);
  return {
    activeTime: formatDuration(today.activeMs),
    longestSession: longestSessionMinutes > 0 ? `${longestSessionMinutes} phút` : null,
    currentSessionMinutes: currentSessionMinutes > 0 ? currentSessionMinutes : null,
    breakCount: today.breakCount,
    extraEvents: buildActivityEvents(status, today)
  };
}
function buildActivityEvents(status, today) {
  const events = [];
  events.push(
    status.running ? "Activity tracker đang chạy trong desktop app." : "Activity tracker chưa chạy trong desktop app."
  );
  if (status.currentApp) {
    events.push(`App hiện tại: ${status.currentApp}.`);
  }
  if (today.sessions.length > 0) {
    events.push(`Hôm nay đã ghi nhận ${today.sessions.length} work session.`);
  } else if (today.activeMs > 0) {
    events.push("Hôm nay đã có active time nhưng chưa đóng work session nào.");
  } else {
    events.push("Hôm nay chưa có activity data được ghi nhận.");
  }
  return events;
}
function formatDuration(milliseconds) {
  if (milliseconds <= 0) {
    return "0 phút";
  }
  const hours = Math.floor(milliseconds / MS_PER_HOUR);
  const minutes = Math.round(milliseconds % MS_PER_HOUR / MS_PER_MINUTE);
  if (hours <= 0) {
    return `${minutes} phút`;
  }
  if (minutes <= 0) {
    return `${hours} giờ`;
  }
  return `${hours} giờ ${minutes} phút`;
}
const activityTracker = createActivityTracker();
function getOnboardingFilePath() {
  return path.join(electron.app.getPath("userData"), "onboarding.json");
}
async function readOnboardingFile() {
  try {
    const content = await promises.readFile(getOnboardingFilePath(), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function writeOnboardingFile(data) {
  const path2 = getOnboardingFilePath();
  await promises.mkdir(electron.app.getPath("userData"), { recursive: true });
  await promises.writeFile(path2, `${JSON.stringify(data, null, 2)}
`, "utf-8");
  return { path: path2 };
}
async function clearOnboardingFile() {
  const path2 = getOnboardingFilePath();
  try {
    await promises.unlink(path2);
  } catch {
  }
  return { path: path2 };
}
let postureProcess = null;
function startPostureTracking() {
  const scriptPath = path.join(__dirname, "../../../../service_ai/main.py");
  postureProcess = child_process.spawn("python", [scriptPath], {
    cwd: path.join(__dirname, "../../../../service_ai"),
    stdio: "inherit"
  });
  postureProcess.on("error", (err) => console.error("[Posture] Failed to start:", err));
  postureProcess.on("exit", (code) => console.log("[Posture] Exited with code:", code));
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  if (process.platform === "win32") {
    electron.app.setAppUserModelId("com.electron");
  }
  electron.app.on("browser-window-created", (_, window) => {
    window.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.code === "F12") {
        window.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  });
  electron.ipcMain.handle("onboarding:read", readOnboardingFile);
  electron.ipcMain.handle("onboarding:write", (_, data) => writeOnboardingFile(data));
  electron.ipcMain.handle("onboarding:clear", clearOnboardingFile);
  electron.ipcMain.handle("onboarding:path", () => getOnboardingFilePath());
  registerActivityIpc(electron.ipcMain, activityTracker, () => electron.BrowserWindow.getAllWindows());
  registerChatIpc(electron.ipcMain, activityTracker);
  createWindow();
  try {
    startPostureTracking();
  } catch (err) {
    console.error("[Posture] Could not start posture tracking:", err);
  }
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  void activityTracker.dispose();
  postureProcess?.kill();
});
