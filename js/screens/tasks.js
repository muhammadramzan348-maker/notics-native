import { state, save, nextId } from "../store.js";
import { ymd, hm, esc, fmtTime, vibrate } from "../util.js";
import { icons, header, bar, gbtn, toast } from "../ui.js";
import { on, onInput, refresh } from "../core.js";
import { askPermission, permission } from "../notify.js";

const draft = { title: "", time: "" };
const today = () => ymd();
const visible = () => state.tasks.filter((t) => t.date === today() || (!t.done && t.date < today()));
const byTime = (a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || a.id - b.id;

function card(t) {
  const carried = !t.done && t.date < today();
  return `<div class="card task fade ${t.done ? "done" : ""}">
    <div class="grow"><div class="t semi" style="font-size:16px">${esc(t.title)}</div>
      <div class="row gap12 xs mt8">${t.time ? `<span class="cyan">⏰ ${fmtTime(t.time)}</span>` : ""}${carried ? '<span class="amber">Carried over</span>' : ""}</div></div>
    <button class="icbtn" data-act="task-del" data-id="${t.id}" aria-label="Delete">🗑</button>
    ${gbtn("task-toggle", t.id, { color: "var(--cyan)", done: t.done, doneLabel: "Undo", compact: true })}</div>`;
}

export function render() {
  const all = visible(), pending = all.filter((t) => !t.done).sort(byTime), done = all.filter((t) => t.done);
  const pct = all.length ? done.length / all.length : 0;
  return `${header(icons.tasks({ size: 34 }), "Tasks", "", new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }))}
  <div class="card mb12">
    <input class="inp" id="t-title" data-in="t-title" placeholder="Add a task, e.g. Go to bank" value="${esc(draft.title)}" enterkeyhint="done" autocomplete="off">
    <div class="row between mt12 gap8">
      <div class="row gap8"><input class="inp" type="time" id="t-time" data-in="t-time" value="${draft.time}" style="width:auto" aria-label="Reminder time">
      ${draft.time ? '<button class="icbtn" data-act="task-cleartime" aria-label="Clear time">✕</button>' : ""}</div>
      <button class="btn primary" data-act="task-add">＋ Add</button></div>
    <div class="muted xs mt8">Pick a time to get a reminder; leave empty for a general daily task.</div>
  </div>
  ${all.length ? `<div class="row between xs muted mb8"><span>Today</span><span style="color:var(--ink)">${done.length}/${all.length} done</span></div>${bar(pct)}<div class="mb12"></div>` : ""}
  ${pending.map(card).join("")}
  ${!all.length ? '<div class="muted" style="text-align:center;margin-top:48px">No tasks yet. Add your first one.</div>' : ""}
  ${all.length && !pending.length ? '<div class="emerald bold" style="text-align:center;margin:24px 0">✓ All done for today</div>' : ""}
  ${done.length ? `<div class="sec">COMPLETED (${done.length})</div>${done.map(card).join("")}` : ""}`;
}

onInput({
  "t-title": (el) => (draft.title = el.value),
  "t-time": (el) => { draft.time = el.value; if (!draft.time) return; refresh(); },
});

on({
  "task-cleartime": () => { draft.time = ""; refresh(); },
  "task-add": async () => {
    const title = draft.title.trim();
    if (!title) return toast("Write a task first");
    const time = draft.time || null;
    if (time && permission() === "default") await askPermission();
    state.tasks.push({ id: nextId(), title, time, date: today(), done: false, doneAt: null });
    save();
    draft.title = ""; draft.time = "";
    if (time && time <= hm()) toast("That time has passed today, saved without a reminder.");
    else if (time && permission() !== "granted") toast("Saved. Notifications are off, so the reminder shows only while NOCTIS is open.", 4500);
    refresh();
  },
  "task-toggle": (el) => {
    const t = state.tasks.find((x) => x.id === +el.dataset.id);
    if (!t) return;
    t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : null; t.date = today();
    vibrate(t.done ? [15, 30, 15] : 8);
    save(); refresh();
  },
  "task-del": (el) => {
    state.tasks = state.tasks.filter((x) => x.id !== +el.dataset.id);
    save(); refresh();
  },
});
