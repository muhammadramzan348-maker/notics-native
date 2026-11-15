import { $, vibrate } from "./util.js";
import { load, meta, state } from "./store.js";
import { icons, pinPad, toast } from "./ui.js";
import { ui, actions, inputs, setRenderer, refresh, lockGuard } from "./core.js";
import { startReminders } from "./notify.js";
import * as tasks from "./screens/tasks.js";
import * as namaz from "./screens/namaz.js";
import * as finance from "./screens/finance.js";
import * as gym from "./screens/gym.js";
import * as binance from "./screens/binance.js";
import * as settings from "./screens/settings.js";
import { setPin, verifyPin } from "./screens/settings.js";

const TABS = [
  ["tasks", "Tasks", icons.tasks, tasks],
  ["namaz", "Namaz", icons.mosque, namaz],
  ["finance", "Finance", icons.wallet, finance],
  ["gym", "Gym", icons.dumbbell, gym],
  ["settings", "More", (o = {}) => `<svg width="${o.size || 26}" height="${o.size || 26}" viewBox="0 0 32 32" fill="none" stroke="${o.active === false ? "#71717A" : "#FAFAFA"}" stroke-width="1.8" stroke-linecap="round"><path d="M5 9h22M5 16h22M5 23h22"/><circle cx="11" cy="9" r="2.6" fill="#09090B"/><circle cx="21" cy="16" r="2.6" fill="#09090B"/><circle cx="13" cy="23" r="2.6" fill="#09090B"/></svg>`, settings],
];

let locked = true, remindersOn = false;

function renderNav() {
  $("#nav").innerHTML = TABS.map(([k, label, ic]) => `<button data-act="tab" data-id="${k}" class="${ui.tab === k && !ui.view ? "on" : ""}" aria-label="${label}">${ic({ size: 26, active: ui.tab === k && !ui.view })}<span>${label}</span></button>`).join("");
}

function render() {
  if (locked) return;
  const scr = $("#screen"), top = scr.scrollTop;
  const mod = ui.view === "binance" ? binance : ui.tab === "settings" || ui.view === "backup" ? settings : TABS.find((t) => t[0] === ui.tab)[3];
  scr.innerHTML = mod.render();
  renderNav();
  scr.scrollTop = top;
}
setRenderer(render);

/* ---------- global event delegation ---------- */
Object.assign(actions, {
  tab: (el) => { ui.view = null; ui.tab = el.dataset.id; $("#screen").scrollTop = 0; render(); },
  open: (el) => { ui.view = el.dataset.id; $("#screen").scrollTop = 0; render(); },
  back: () => { ui.view = null; $("#screen").scrollTop = 0; render(); },
});
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const f = actions[el.dataset.act];
  if (f) { vibrate(8); f(el, e); }
});
document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-in]");
  if (el && inputs[el.dataset.in]) inputs[el.dataset.in](el, e);
});

/* ---------- PIN lock ---------- */
let fails = 0, coolUntil = 0;
function showLock() {
  locked = true;
  $("#layer").innerHTML = "";
  $("#screen").innerHTML = "";
  $("#app").classList.add("hidden");
  const box = $("#lock");
  box.classList.remove("hidden");
  const head = `<div style="text-align:center;margin-bottom:40px"><div class="glow-ic" style="--g:#06B6D4;font-size:38px;color:#06B6D4">☾</div><div class="bold" style="letter-spacing:.5em;margin-top:8px;margin-right:-.5em">NOCTIS</div></div><div id="pp" style="width:100%"></div>`;
  box.innerHTML = head;
  const pp = box.querySelector("#pp");
  if (meta.get("pin")) {
    const pad = pinPad(pp, {
      title: "Welcome back", subtitle: "Enter your PIN",
      disabled: () => Date.now() < coolUntil,
      onSubmit: async (p) => {
        if (Date.now() < coolUntil) return false;
        if (await verifyPin(p)) { fails = 0; unlock(); return true; }
        if (++fails >= 5) { fails = 0; coolUntil = Date.now() + 30000; const t = setInterval(() => { const s = Math.ceil((coolUntil - Date.now()) / 1000); if (s <= 0) { clearInterval(t); pad.setSubtitle("Enter your PIN"); } else pad.setSubtitle(`Too many attempts. Wait ${s}s`); }, 500); }
        return false;
      },
    });
  } else {
    let first = "";
    const step = (n) => {
      box.querySelector("#pp").innerHTML = ""; const fresh = box.querySelector("#pp").cloneNode(false); box.querySelector("#pp").replaceWith(fresh);
      if (n === 0) pinPad(fresh, { title: "Create your PIN", subtitle: "4 digits to protect NOCTIS", onSubmit: async (p) => { first = p; step(1); return true; } });
      else pinPad(fresh, { title: "Confirm your PIN", subtitle: "Enter it once more", onSubmit: async (p) => { if (p !== first) return false; await setPin(p); unlock(); return true; } });
    };
    step(0);
  }
}
function unlock() {
  locked = false;
  $("#lock").classList.add("hidden");
  $("#lock").innerHTML = "";
  $("#app").classList.remove("hidden");
  render();
  if (!remindersOn) { remindersOn = true; startReminders(); }
}
window.addEventListener("noctis-lock", () => { if (meta.get("pin")) showLock(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && !locked && !lockGuard.suspended && meta.get("pin")) showLock(); });

/* ---------- boot ---------- */
(async function boot() {
  await load();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  showLock();
  window.__noctis = { get state() { return state; }, ui, render, unlock: () => unlock() }; // handy for debugging / tests
})();
