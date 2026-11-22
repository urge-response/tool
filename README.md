# 4 Steps + 1 — Addiction Urge Response PWA prototype

This is a first working prototype adapted from the approved Version 6.3 Android content. It is intended for testing with **fictional reflections** before public release.

## Publish to GitHub Pages
1. Create a public GitHub repository (e.g., `urge-response`).
2. Upload the **contents of this folder** to the repository root, including `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, and the `icons` folder.
3. In the repository, open Settings → Pages → Build and deployment → Deploy from a branch, select `main` and `/ (root)`, then Save.
4. Visit the resulting `https://<username>.github.io/<repo>/` URL. HTTPS is required for Web Crypto and service workers.
5. On Android Chrome, use Install app / Add to Home screen; on iOS Safari, use Share → Add to Home Screen.

## Security and limitations
- All draft and history records are stored in IndexedDB as a single AES-256-GCM ciphertext, using a key derived from a user-supplied passphrase via PBKDF2-SHA256 (310,000 iterations). The key is kept only in memory while unlocked.
- The PWA has no server-side storage, account, analytics, or cloud sync. Hosting still involves normal web-server requests and associated hosting logs.
- No password reset or recovery. If you forget your passphrase, your data is inaccessible.
- Browser data can be deleted or evicted, losing your encrypted records. There is no export/restore in this prototype.
- Closing the app while an asynchronous write is in flight could lose the latest keystrokes. Wait briefly after typing before closing. Lock App waits for pending saves.
- While unlocked, the app can be visible in the app switcher; PWAs cannot guarantee screenshot blocking.
- Copied text leaves the encrypted vault and enters the system clipboard.
- Existing Android Keystore-encrypted check-ins are not automatically migrated.
- This is not a clinical treatment or emergency service. The content should undergo appropriate safety and accessibility review before broad public release.

## Test
- Create a vault with a passphrase of at least 12 characters.
- Create a draft, wait a moment, reload, unlock, and confirm it returns.
- Save and delete entries; reload and confirm changes.
- Lock app, unlock with the correct passphrase, and try an incorrect passphrase.
- Install the PWA, open once while online, then switch to airplane mode and relaunch.
- Test on Android, iOS Safari, and desktop browsers.

The JavaScript passed `node --check`, but browser end-to-end testing was blocked in this execution environment. Treat this as a prototype, not a production-audited security implementation.

## Version 1.1 startup fix
- The passphrase/setup screen is visible by default, so a JavaScript failure cannot leave both panels invisible.
- An initialization failure now shows a visible message.
- The service worker cache is bumped and navigation is network-first when online.
- To update GitHub Pages, **replace all files** with the contents of this ZIP. Allow deployment to finish, then refresh the site twice. Existing encrypted IndexedDB records are not intentionally deleted.

## Version 1.2 troubleshooting
If vault creation does not work, the error now displays below the button. Use a 12+ character passphrase, enter the same value twice, and access the site via its HTTPS GitHub Pages URL. Update **all files** (including `app.js`, `index.html`, `sw.js`) and hard refresh. Existing encrypted vaults are not intentionally deleted.

## Version 1.3
Adds home-screen installation instructions to the app home page for Android Chrome and iPhone Safari. No changes to encryption, passphrase, check-in questions, or saved-data format. Upload all files, including the updated service worker, to GitHub Pages.

## Version 1.4 navigation fix
The check-in controls now use one persistent delegated click listener, rather than handlers bound separately to buttons that are recreated on each screen. Navigation errors are displayed in the interface. Update `index.html`, `app.js`, and `sw.js` together; all other files may be kept. The encrypted vault database name and format are unchanged.

## Version 1.5
Restores missing `hasContent` helper used by draft saving and check-in navigation. No changes to the IndexedDB name, encryption scheme, vault record format, or approved questions. Upload `app.js`, `index.html`, and `sw.js` together. Do not clear site data.
