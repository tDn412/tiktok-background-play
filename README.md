# TikTok Background Play (Firefox)

A tiny Firefox extension that keeps TikTok videos and sound playing when you switch tabs, minimize the window, or put Firefox behind another app. It works on every `tiktok.com` page and is always on: there is no toggle and no settings.

## How it works

TikTok pauses playback when the browser reports that the page is hidden (`document.hidden`, `visibilitychange`, window `blur`). The extension injects a small script into TikTok pages before TikTok's own code runs and:

1. Reports the page as always visible and focused.
2. Blocks the `visibilitychange` and `blur` events so TikTok never hears about the tab going to the background.
3. As a safety net, ignores `pause()` calls from TikTok's scripts while the tab is really hidden. Pausing with your keyboard's media keys or the system media controls still works.

It has no permissions beyond running on `tiktok.com`, collects nothing, and makes no network requests.

Requires Firefox 128 or newer.

## Install

### Option A: temporary load (quickest, for trying it)

1. Download this repo (Code → Download ZIP) and unzip it, or `git clone` it.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on…** and pick the `manifest.json` file in the folder.
4. Reload any open TikTok tabs.

Temporary add-ons are removed when Firefox restarts, so you'll need to repeat step 3 after each restart.

### Option B: permanent install (unlisted signing on addons.mozilla.org)

Release Firefox only installs signed add-ons. You can sign it for yourself for free without publishing it in the store:

1. Zip the extension files (not the folder around them):
   ```sh
   zip -r tiktok-background-play.zip manifest.json inject.js icons
   ```
2. Sign in at <https://addons.mozilla.org/developers/addon/submit/distribution> and choose **On your own** (unlisted).
3. Upload the zip. Automatic review usually finishes within minutes.
4. Download the signed `.xpi` and open it in Firefox (or drag it into a Firefox window) to install. It now survives restarts.

Alternatively, with [`web-ext`](https://github.com/mozilla/web-ext) and AMO API keys:

```sh
npx web-ext sign --channel=unlisted --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET
```

## License

MIT
