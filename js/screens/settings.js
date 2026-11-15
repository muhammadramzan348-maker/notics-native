import { state, meta } from "../store.js";
import { esc, sha256Hex, randHex, fmtDay } from "../util.js";
import { sheet, toast, confirmBox, alertBox, chip, pinPad, header } from "../ui.js";
import { on, ui, refresh, withoutLock } from "../core.js";
import { collect, encryptBackup, decryptBackup, peekEnvelope, restore, summarize, normalize, SUMMARY, BackupError } from "../backup.js";
import { permission, askPermission } from "../notify.js";

export async function verifyPin(pin) { const p = meta.get("pin"); return !!p && (await sha256Hex(p.salt + pin)) === p.hash; }
export async function setPin(pin) { const salt = randHex(16); meta.set("pin", { salt, hash: await sha256Hex(salt + pin) }); }

let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });
window.addEventListener("appinstalled", () => (deferredInstall = null));

const row = (icon, label, act, sub = "") => `<button class="card row mb12 block" style="width:100%;text-align:left" data-act="${act}"><span style="font-size:20px;width:32px">${icon}</span><span class="grow"><b>${label}</b>${sub ? `<br><span class="muted xs">${sub}</span>` : ""}</span><span class="muted">›</span></button>`;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;

export function render() {
  if (ui.view === "backup") return renderBackup();
  const perm = permission();
  return `${header("⚙️", "Settings", "", "NOCTIS · works fully offline")}
  ${row("🔑", "Change PIN", "set-pin")}${row("🔒", "Lock now", "set-lock")}${row("☁️", "Backup & restore", "go-backup", "Encrypted file you can store or share")}
  ${row("🔔", "Notifications", "set-notif", perm === "granted" ? "Allowed" : perm === "denied" ? "Blocked in browser settings" : perm === "unsupported" ? "Not supported here" : "Tap to allow")}
  ${isStandalone() ? "" : row("📲", "Install NOCTIS", "set-install", deferredInstall ? "Add to your home screen" : "Use browser menu → Install / Add to Home screen")}
  <div class="card mt16 muted xs" style="line-height:1.6"><b style="color:var(--ink)">About reminders</b><br>A web app cannot wake your phone when it is closed. Task and namaz reminders fire while NOCTIS is open (even in the background tab) and show as notifications. For guaranteed alarms keep your phone's own alarm for important prayers.<br><br><b style="color:var(--ink)">About privacy</b><br>All data stays on this device (IndexedDB). The PIN only locks the screen; the stored data is not encrypted. Backups are encrypted with your backup password.</div>`;
}

function renderBackup() {
  const last = meta.get("lastBackup");
  return `<button class="icbtn" data-act="back" style="margin-bottom:8px">‹ Back</button>${header("☁️", "Backup & Restore", "", "Encrypted with AES-256-GCM")}
  <div class="card muted sm">Includes Tasks, Namaz, Finance, Binance and Gym. Your PIN is never included. Pick a backup password you will remember: <b class="amber">without it the file cannot be opened.</b></div>
  <div class="sec">CREATE BACKUP</div><div class="card">
    <div class="field"><label class="lbl">Backup password (min 8 characters)</label><input class="inp" id="bk-pw" type="password" autocomplete="new-password"></div>
    <div class="field"><label class="lbl">Confirm password</label><input class="inp" id="bk-pw2" type="password" autocomplete="new-password"></div><div class="crimson xs hidden" id="bk-mm">Passwords do not match.</div>
    <div class="row gap12 mt12"><button class="btn primary grow" data-act="bk-share" id="bk-share">⤴ Share</button><button class="btn grow" data-act="bk-save" id="bk-save">⬇ Download</button></div>
    <div class="muted xs mt12" id="bk-status">Last backup: ${last ? new Date(last).toLocaleString("en-GB") : "never"}</div></div>
  <div class="sec">RESTORE</div><div class="card"><div class="muted sm mb12">Choose a NOCTIS backup file (.json). Merge adds only what is missing; Replace erases current data first.</div>
    <button class="btn block" data-act="bk-pick">📂 Restore from backup</button><input type="file" id="bk-file" accept=".json,application/json" class="hidden"></div>`;
}

const pwOk = () => { const a = document.getElementById("bk-pw").value, b = document.getElementById("bk-pw2").value; document.getElementById("bk-mm").classList.toggle("hidden", !b || a === b); return a.length >= 8 && a === b; };
const fname = () => `NOCTIS-backup-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, (c) => (c === "T" ? "-" : "")) }.json`;
const mark = () => { meta.set("lastBackup", new Date().toISOString()); const s = document.getElementById("bk-status"); if (s) s.textContent = "Last backup: " + new Date().toLocaleString("en-GB"); };

async function makeBackup() {
  if (!pwOk()) { toast("Password must be 8+ characters and match."); return null; }
  const st = document.getElementById("bk-status"); st.textContent = "Encrypting…";
  const text = await encryptBackup(collect(), document.getElementById("bk-pw").value);
  return { text, name: fname() };
}

function restoreFlow(text) {
  let env; try { env = peekEnvelope(text); } catch (e) { return alertBox("Cannot open file", e.message); }
  const s = sheet("Unlock backup", `<div class="muted sm mb12">Backup created ${new Date(env.createdAt).toLocaleString("en-GB")}</div><div class="field"><label class="lbl">Backup password</label><input class="inp" id="rp" type="password" autocomplete="off"></div><button class="btn primary block" id="ru">🔓 Unlock</button>`);
  const q = (i) => s.el.querySelector(i);
  q("#ru").onclick = async () => {
    q("#ru").disabled = true; q("#ru").textContent = "Decrypting…";
    try {
      const { data, createdAt } = await decryptBackup(text, q("#rp").value);
      const clean = normalize(data); let mode = "merge";
      s.root.querySelector("h3 span").textContent = "Review & restore";
      const paint = () => {
        s.el.innerHTML = `<div class="muted sm mb12">Backup from ${new Date(createdAt).toLocaleString("en-GB")} contains:</div><div class="card mb12" style="background:var(--bg);padding:12px">${summarize(clean).map((x) => `<div class="row between sm" style="padding:3px 0"><span class="muted">${x.label}</span><b>${x.count}</b></div>`).join("")}</div>
        <div class="row wrap"><button class="chip ${mode === "merge" ? "on emerald" : ""}" data-m="merge">Merge (recommended)</button><button class="chip ${mode === "replace" ? "on crimson" : ""}" data-m="replace">Replace everything</button></div>
        <div class="muted xs mb12">${mode === "merge" ? "Adds only what is missing. Records you already have are skipped, so restoring the same file twice changes nothing." : "Erases the current data first, then loads the backup exactly as it was."}</div>
        <button class="btn ${mode === "replace" ? "danger" : "primary"} block" id="go">☁ Restore now</button>`;
        s.el.querySelector("#go").onclick = async () => {
          if (mode === "replace" && !(await confirmBox("Replace everything?", "All current NOCTIS data on this device will be erased and replaced by the backup. This cannot be undone.", { ok: "Replace", danger: true }))) return;
          try { const rep = restore(data, mode); finish(rep); } catch (e) { alertBox("Restore failed", "Nothing was changed. " + e.message); }
        };
      };
      s.el.addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) { mode = b.dataset.m; paint(); } });
      const finish = (rep) => {
        const a = Object.values(rep.added).reduce((x, y) => x + y, 0), k = Object.values(rep.skipped).reduce((x, y) => x + y, 0);
        s.root.querySelector("h3 span").textContent = "Restore complete";
        s.el.innerHTML = `<div style="text-align:center;font-size:44px">✅</div><div class="bold" style="text-align:center;font-size:18px">${mode === "replace" ? "Data replaced" : a + " records restored"}</div><div class="muted sm" style="text-align:center;margin-bottom:16px">${mode === "replace" ? "" : k + " already existed and were skipped"}</div><button class="btn primary block" id="ok">Done</button>`;
        s.el.querySelector("#ok").onclick = () => { s.close(); ui.view = null; ui.tab = "tasks"; refresh(); };
      };
      paint();
    } catch (e) { q("#ru").disabled = false; q("#ru").textContent = "🔓 Unlock"; alertBox("Cannot open backup", e instanceof BackupError ? e.message : "Something went wrong."); }
  };
}

on({
  "go-backup": () => { ui.view = "backup"; refresh(); },
  "set-lock": () => window.dispatchEvent(new Event("noctis-lock")),
  "set-pin": () => {
    const s = sheet("Change PIN", `<div id="pp"></div>`);
    let fresh = "";
    const step = (n) => {
      s.el.innerHTML = '<div id="pp"></div>'; const root = s.el.firstElementChild;
      if (n === 0) pinPad(root, { title: "Current PIN", onSubmit: async (p) => { if (!(await verifyPin(p))) return false; step(1); return true; } });
      if (n === 1) pinPad(root, { title: "New PIN", subtitle: "Choose 4 digits", onSubmit: async (p) => { fresh = p; step(2); return true; } });
      if (n === 2) pinPad(root, { title: "Confirm new PIN", onSubmit: async (p) => { if (p !== fresh) return false; await setPin(p); s.close(); toast("PIN changed"); return true; } });
    };
    step(0);
  },
  "set-notif": async () => { const p = await askPermission(); toast(p === "granted" ? "Notifications allowed" : p === "denied" ? "Blocked. Enable them in the browser's site settings." : "Not available here"); refresh(); },
  "set-install": async () => {
    if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; refresh(); }
    else alertBox("Install NOCTIS", "Android Chrome: menu ⋮ → Install app.\niPhone Safari: Share → Add to Home Screen.\nDesktop Chrome/Edge: install icon in the address bar.");
  },
  "bk-share": async () => {
    const b = await makeBackup(); if (!b) return;
    const file = new File([b.text], b.name, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await withoutLock(() => navigator.share({ files: [file], title: "NOCTIS backup" })); mark(); toast("Backup shared"); }
      else { download(b); mark(); toast("Sharing not supported here, downloaded instead"); }
    } catch (e) { if (e.name !== "AbortError") toast("Share failed: " + e.message); else document.getElementById("bk-status").textContent = "Cancelled"; }
  },
  "bk-save": async () => { const b = await makeBackup(); if (!b) return; download(b); mark(); toast("Backup downloaded"); },
  "bk-pick": async () => {
    const inp = document.getElementById("bk-file");
    inp.value = "";
    await withoutLock(async () => inp.click());
  },
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "bk-file") return;
  const f = e.target.files[0];
  if (f) restoreFlow(await f.text());
});
function download({ text, name }) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
