import { state } from "./store.js";
import { PRAYER } from "./data.js";
import { ymd, hm, fmtTime } from "./util.js";
import { toast } from "./ui.js";

const KEY = "noctis_fired";
const WINDOW_MIN = 10; // still fire if the page was asleep for a few minutes

const minutes = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const loadFired = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || "{}"); return o.d === ymd() ? o : { d: ymd(), k: [] }; } catch { return { d: ymd(), k: [] }; } };

export const permission = () => ("Notification" in window ? Notification.permission : "unsupported");

export async function askPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}

async function fire(title, body, tag) {
  toast(`🔔 ${title}: ${body}`, 6000);
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch {}
  if (permission() !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return reg.showNotification(title, { body, tag, icon: "icons/icon-192.png", badge: "icons/favicon.png", vibrate: [200, 100, 200] });
    new Notification(title, { body, tag, icon: "icons/icon-192.png" });
  } catch {}
}

export function tick() {
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes(), today = ymd(now);
  const fired = loadFired();
  const due = (time) => { const d = nowM - minutes(time); return d >= 0 && d <= WINDOW_MIN; };
  const once = (k) => { if (fired.k.includes(k)) return false; fired.k.push(k); return true; };

  for (const t of state.tasks)
    if (!t.done && t.time && t.date === today && due(t.time) && once(`t${t.id}`))
      fire("Task reminder", t.title, `task-${t.id}`);

  for (const [key, cfg] of Object.entries(state.prayerCfg || {})) {
    if (!cfg.on || !PRAYER[key] || !due(cfg.time)) continue;
    if ((state.prayerLogs[today] || {})[key]) continue; // already prayed
    if (once(`p${key}`)) fire(`${PRAYER[key].label} time`, `It's time for ${PRAYER[key].label} (${fmtTime(cfg.time)})`, `prayer-${key}`);
  }
  localStorage.setItem(KEY, JSON.stringify(fired));
}

export function startReminders() {
  tick();
  setInterval(tick, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}
