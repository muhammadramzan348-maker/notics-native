# NOCTIS (PWA)

Ultra-dark, offline-first life manager: Tasks, Namaz (+ Friday Jummah), Finance, Binance/USDT tracker, Gym,
PIN lock and encrypted backup/restore. No build step, no dependencies.

## Run locally
    cd noctis-pwa
    python3 -m http.server 8000        # then open http://localhost:8000

## Put it on your phone (needs HTTPS, otherwise it cannot install or encrypt backups)
Upload this whole folder to any static host, for example:
* Netlify:  drag & drop the folder at app.netlify.com/drop
* GitHub Pages / Cloudflare Pages / Vercel: push the folder, enable static hosting
Then open the https:// link on your phone:
* Android Chrome: menu -> "Install app"
* iPhone Safari:  Share -> "Add to Home Screen"
After the first visit the app works fully offline.

## Notes
* Data lives in the browser's IndexedDB on that device. Clearing site data deletes it, so make backups.
* Backups are AES-256-GCM (PBKDF2-SHA256, 250k iterations). Android-app backups (XChaCha20) are not readable here.
* Browsers cannot wake a closed web app: reminders fire while NOCTIS is open (or in a background tab).
* Urdu/Arabic fonts load from Google Fonts on the first online visit and are then cached for offline use.
* When you change any file, bump VERSION in sw.js so phones pick up the update.
