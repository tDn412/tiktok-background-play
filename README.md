# TikTok Background Play (Firefox)

A tiny Firefox extension that makes TikTok on the web nicer to leave running:

- **Background play:** videos and sound keep playing when you switch tabs, minimize the window, or put Firefox behind another app.
- **Best quality:** every video plays in the highest-quality stream TikTok has for it, instead of the mid-quality one the web player picks.
- **Lower memory use:** videos you've scrolled far past release their downloaded data, so long scrolling sessions don't keep growing.

It works on every `tiktok.com` page and is always on: there is no toggle and no settings.

## How it works

All three parts are small scripts injected into TikTok pages before TikTok's own code runs.

**Background play** (`src/background-play.js`). TikTok pauses playback when the browser reports that the page is hidden (`document.hidden`, `visibilitychange`, window `blur`). The script:

1. Reports the page as always visible and focused.
2. Blocks the `visibilitychange` and `blur` events so TikTok never hears about the tab going to the background.
3. As a safety net, ignores `pause()` calls from TikTok's scripts while the tab is really hidden. Pausing with your keyboard's media keys or the system media controls still works.

Firefox still skips drawing video frames in a hidden tab, so background play costs about as much as audio alone.

**Best quality** (`src/quality.js`). TikTok's video data lists every encoding of a clip (`video.bitrateInfo`: 540p, 720p, 1080p, in H.264 and H.265) but hands the web player a mid-quality `playAddr`. The script rewrites that data as it arrives (API responses and the data embedded in the page) so the player only sees the highest-resolution, highest-bitrate H.264 stream. H.264 is used because it always plays in Firefox and always includes the audio track; some H.265 streams are video-only, and ByteDance's own "bytevc2" codec doesn't play in any browser.

Sound comes from the same file as the picture, so picking the best stream also gets the best audio TikTok serves for that clip. There is no way for an extension to make the audio better than what TikTok uploaded.

**Lower memory use** (`src/memory.js`). Every 10 seconds the script looks for videos that are paused, have been idle for 30 seconds, and are at least two screens away from what you're watching. Their source is detached so Firefox can free the buffered and decoded data. When you scroll back within two screens, or anything tries to play the video, the source is put back. The videos right before and after the current one are never touched, so swiping stays instant.

Best quality uses more bandwidth than TikTok's default. On a slow connection, videos may take a moment longer to start.

The extension asks for no permissions beyond running on `tiktok.com`, collects nothing, and makes no network requests of its own.

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
   zip -r tiktok-background-play.zip manifest.json src icons
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
