"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
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
const CHAT_CHANNELS = {
  sendMascotMessage: "chat:mascot:send-message"
};
function subscribe(channel, callback) {
  const listener = (_event, payload) => {
    callback(payload);
  };
  electron.ipcRenderer.on(channel, listener);
  return () => {
    electron.ipcRenderer.removeListener(channel, listener);
  };
}
const activity = {
  start: () => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.start),
  stop: () => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.stop),
  status: () => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.status),
  getToday: () => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.getToday),
  getDay: (date) => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.getDay, date),
  listDays: () => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.listDays),
  backfill: (options) => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.backfill, options),
  backfillSupport: () => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.backfillSupport),
  openHistoryPermission: () => electron.ipcRenderer.invoke(ACTIVITY_CHANNELS.openPermission),
  onUpdate: (callback) => subscribe(ACTIVITY_CHANNELS.update, callback),
  onEvent: (callback) => subscribe(ACTIVITY_CHANNELS.event, callback)
};
const mascotChat = {
  sendMessage: (request) => electron.ipcRenderer.invoke(CHAT_CHANNELS.sendMascotMessage, request)
};
const api = { activity, mascotChat };
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
