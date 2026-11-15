import { state, save } from "../store.js";
import { PRAYERS, PRAYER, JUMUAH_ITEMS } from "../data.js";
import { ymd, addDays, parseYmd, isoDow, fmtTime, fmtDay, vibrate, esc } from "../util.js";
import { icons, header, gbtn, sheet, toast, chip } from "../ui.js";
import { prayerArt } from "../icons.js";
import { on, ui, refresh } from "../core.js";
import { askPermission, permission } from "../notify.js";

const logs = (d) => state.prayerLogs[d] || {};
const count = (d) => PRAYERS.filter((p) => logs(d)[p.key]).length;
const cfg = (k) => state.prayerCfg[k] || { time: PRAYER[k].time, on: false };

function streaks() {
  let d = new Date(); if (count(ymd(d)) < 5) d = addDays(d, -1);
  let cur = 0; while (count(ymd(d)) >= 5) { cur++; d = addDays(d, -1); }
  const full = Object.keys(state.prayerLogs).filter((k) => count(k) >= 5).sort();
  let best = 0, run = 0, prev = null;
  for (const k of full) { const dt = parseYmd(k); run = prev && Math.round((dt - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = dt; }
  return { cur, best };
}

function prayerCard(p, i) {
  const c = cfg(p.key), done = !!logs(ymd())[p.key];
  return `<div class="pcard fade ${done ? "isdone" : ""}" style="--bc:${done ? "#10B98199" : p.accent + "55"};background:linear-gradient(115deg,${p.grad[0]} 0%,${p.grad[1]} 50%,${p.grad[2]} 100%);animation-delay:${i * 60}ms" data-card="${p.key}">
    <div class="art">${prayerArt(p.key)}</div>
    <div class="in">
      <div class="ur">${p.urdu}</div>
      <div class="bold xs" style="color:${p.accent};letter-spacing:.15em">${p.label.toUpperCase()}</div>
      <div class="mt16">${gbtn("pr-toggle", p.key, { color: p.accent, done, label: "Done", doneLabel: "Prayed ✓" })}</div>
      <div class="row mt16 gap12">
        <button class="pchip" style="color:${p.accent};border-color:${p.accent}66" data-act="pr-time" data-id="${p.key}">⏰ ${fmtTime(c.time)}</button>
        <button class="icbtn" style="color:${c.on ? p.accent : "var(--muted)"};font-size:18px" data-act="pr-bell" data-id="${p.key}" aria-label="Reminder">${c.on ? "🔔" : "🔕"}</button>
      </div></div></div>`;
}

function jumuahCard() {
  const d = ymd(), L = state.jumuah[d] || {}, n = JUMUAH_ITEMS.filter((j) => L[j.key]).length, all = n === JUMUAH_ITEMS.length;
  return `<div class="pcard fade" style="--bc:${all ? "#10B981AA" : "#FBBF2455"};background:linear-gradient(135deg,#141417,#0E2A1F,#2A2209);margin-top:6px"><div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--gold)"></div>
  <div class="in">
    <div class="row between"><div><div class="ur gold" style="font-size:34px;line-height:1.9;margin:-6px 0 -12px">جمعۃ المبارک</div><div class="muted xs" style="letter-spacing:.15em">FRIDAY SUNNAH CHECKLIST</div></div>
      <div style="text-align:center"><div style="font-size:22px">${all ? "✅" : "✨"}</div><div class="bold" style="color:${all ? "var(--emerald)" : "var(--ink)"}">${n}/${JUMUAH_ITEMS.length}</div></div></div>
    <div class="bar mt12 mb8"><i style="width:${(n / JUMUAH_ITEMS.length) * 100}%;background:${all ? "var(--emerald)" : "var(--gold)"}"></i></div>
    ${JUMUAH_ITEMS.map((j, i) => `<div class="row" style="padding:8px 0;${i ? "border-top:1px solid var(--line)" : ""}">
      <div class="grow" style="padding-right:10px"><div class="urdu" style="font-size:19px;line-height:2.1;color:${L[j.key] ? "#71717A" : "#FAFAFA"};${L[j.key] ? "text-decoration:line-through" : ""}">${j.urdu}</div><div class="xs" style="color:#71717A">${j.en}</div></div>
      ${gbtn("jm-toggle", j.key, { color: "var(--gold)", done: !!L[j.key], compact: true })}</div>`).join("")}
    ${all ? '<div class="emerald sm" style="text-align:center;margin-top:10px">✦ Masha\'Allah, all Friday sunnahs completed</div>' : ""}
  </div></div>`;
}

function calendar() {
  const m = ui.calMonth || (ui.calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const lead = (m.getDay() + 6) % 7, total = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), today = ymd();
  const sel = ui.selDay || today, cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="e"></div>');
  for (let day = 1; day <= total; day++) {
    const ds = ymd(new Date(m.getFullYear(), m.getMonth(), day)), c = count(ds);
    const cls = [c >= 5 ? "full" : c > 0 ? "part" : "", ds === today ? "today" : "", ds === sel ? "sel" : "", ds > today ? "fut" : ""].join(" ");
    cells.push(`<div class="${cls}" data-act="cal-pick" data-id="${ds}" style="cursor:pointer">${day}</div>`);
  }
  const canNext = !(m.getFullYear() === new Date().getFullYear() && m.getMonth() === new Date().getMonth());
  const L = logs(sel);
  return `<div class="card"><div class="row between mb12"><button class="icbtn" style="font-size:20px" data-act="cal-prev">‹</button><b>${m.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b><button class="icbtn" style="font-size:20px;${canNext ? "" : "opacity:.25;pointer-events:none"}" data-act="cal-next">›</button></div>
    <div class="cal">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<div class="h">${d}</div>`).join("")}${cells.join("")}</div>
    <div class="row xs muted mt12 gap12"><span><b class="emerald">■</b> All 5</span><span><b class="amber">■</b> Partial</span><span><b class="cyan">□</b> Today</span></div></div>
  <div class="card mt12"><div class="semi">${fmtDay(sel, { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</div><div class="muted xs mb12">Tap to mark or fix a day you forgot to log.</div>
    <div class="row wrap">${PRAYERS.map((p) => chip(`${p.urdu}  ${p.label}`, "cal-toggle", p.key, !!L[p.key], "emerald")).join("")}</div></div>`;
}

export function render() {
  const t = ymd(), st = streaks(), done = count(t);
  let sum30 = 0; for (let i = 0; i < 30; i++) sum30 += count(ymd(addDays(new Date(), -i)));
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i - 6)));
  return `${header(icons.mosque({ size: 34 }), "Namaz", "نماز", `${done} of 5 prayed today`)}
  <div class="card"><div class="row"><div style="width:56px;height:56px;border-radius:16px;background:rgba(245,158,11,.15);display:flex;align-items:center;justify-content:center;font-size:28px">🔥</div>
    <div class="grow" style="margin-left:14px"><div class="h1">${st.cur} <span class="muted sm" style="font-weight:400">day streak</span></div><div class="muted sm">Best: ${st.best} days</div></div>
    <div style="text-align:right"><div class="emerald h1">${Math.round((sum30 / 150) * 100)}%</div><div class="muted xs">30-day consistency</div></div></div>
    <div class="row between mt16" style="align-items:flex-end;height:70px">${days.map((d) => { const c = count(d), col = c >= 5 ? "var(--emerald)" : c > 0 ? "var(--amber)" : "var(--line)"; return `<div style="flex:1;text-align:center"><div style="width:14px;margin:0 auto;height:${Math.max(5, (c / 5) * 46)}px;border-radius:7px;background:${col};${c ? `box-shadow:0 0 8px ${col}` : ""}"></div><div class="muted xs" style="margin-top:6px">${parseYmd(d).toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2)}</div></div>`; }).join("")}</div></div>
  <div class="sec">TODAY</div>${PRAYERS.map(prayerCard).join("")}
  ${isoDow() === 5 ? jumuahCard() : ""}
  <div class="sec">HISTORY</div>${calendar()}`;
}

function setPrayer(date, key, v) {
  const m = (state.prayerLogs[date] ||= {});
  if (v) m[key] = true; else delete m[key];
  if (!Object.keys(m).length) delete state.prayerLogs[date];
}

on({
  "pr-toggle": (el) => {
    const t = ymd(), k = el.dataset.id, v = !logs(t)[k];
    setPrayer(t, k, v); vibrate(v ? [15, 30, 15] : 8); save(); refresh();
    const card = document.querySelector(`[data-card="${k}"]`); card && card.classList.add("pop");
  },
  "cal-toggle": (el) => { const d = ui.selDay || ymd(), k = el.dataset.id; setPrayer(d, k, !logs(d)[k]); save(); refresh(); },
  "cal-pick": (el) => { ui.selDay = el.dataset.id; refresh(); },
  "cal-prev": () => { ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() - 1, 1); refresh(); },
  "cal-next": () => { ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + 1, 1); refresh(); },
  "jm-toggle": (el) => {
    const d = ymd(), k = el.dataset.id, m = (state.jumuah[d] ||= {});
    if (m[k]) delete m[k]; else m[k] = true;
    if (!Object.keys(m).length) delete state.jumuah[d];
    vibrate(10); save(); refresh();
  },
  "pr-time": (el) => {
    const k = el.dataset.id, c = cfg(k);
    const s = sheet(`${PRAYER[k].label} reminder time`, `<div class="field"><label class="lbl">Time</label><input class="inp" type="time" id="pt" value="${c.time}"></div><button class="btn primary block" id="pt-save">Save</button>`);
    s.el.querySelector("#pt-save").onclick = () => {
      const v = s.el.querySelector("#pt").value; if (!v) return;
      state.prayerCfg[k] = { ...cfg(k), time: v }; save(); s.close(); refresh();
    };
  },
  "pr-bell": async (el) => {
    const k = el.dataset.id, c = cfg(k), turnOn = !c.on;
    if (turnOn && permission() === "default") await askPermission();
    state.prayerCfg[k] = { ...c, on: turnOn }; save(); refresh();
    if (turnOn && permission() !== "granted") toast("Notifications are blocked, so this reminder shows only while NOCTIS is open.", 4500);
  },
});
