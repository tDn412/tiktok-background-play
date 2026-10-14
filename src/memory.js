// Free the memory held by videos you've scrolled far away from.
//
// TikTok keeps <video> elements (and their downloaded/decoded data) alive for
// items well behind or ahead of the one you're watching. A video that is
// paused, more than two screens away, and hasn't played for a while gets its
// source detached so the browser can drop its buffers. As soon as it comes
// back within two screens, or anything tries to play it, the source is put
// back. The next and previous videos are never touched, so swiping stays
// instant.
(() => {
  "use strict";
  if (window.__tiktokMemorySaver) return;
  window.__tiktokMemorySaver = true;

  const SWEEP_MS = 10000;      // how often to look for idle videos
  const IDLE_MS = 30000;       // must have been paused this long
  const SCREENS_AWAY = 2;      // and at least this many screens away

  const proto = HTMLMediaElement.prototype;
  const origLoad = proto.load;
  const origPlay = proto.play;
  const released = new WeakMap(); // video -> { src, time }
  const lastActive = new WeakMap();
  const now = () => performance.now();

  // While a video is detached, hide the media events that detaching causes
  // (emptied, abort, ...) so TikTok's player doesn't show an error or react.
  const MEDIA_EVENTS = ["abort", "emptied", "error", "loadstart", "suspend", "stalled",
    "waiting", "durationchange", "timeupdate", "pause", "progress"];
  for (const type of MEDIA_EVENTS) {
    window.addEventListener(type, (e) => {
      if (released.has(e.target)) e.stopImmediatePropagation();
    }, true);
  }

  const restore = (video) => {
    const state = released.get(video);
    if (!state) return;
    released.delete(video);
    io && io.unobserve(video);
    lastActive.set(video, now());
    video.setAttribute("src", state.src); // setting src starts loading by itself
    if (state.time > 0) {
      video.addEventListener("loadedmetadata", () => {
        try { if (video.currentTime < 0.1) video.currentTime = state.time; } catch (_) {}
      }, { once: true });
    }
  };

  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) restore(e.target);
      }, { rootMargin: `${SCREENS_AWAY * 100}% 0px ${SCREENS_AWAY * 100}% 0px` })
    : null;

  const release = (video) => {
    const src = video.getAttribute("src");
    // Only plain file URLs can be re-attached later. blob: (MediaSource)
    // streams can't, and <source> children are left alone.
    if (!src || src.startsWith("blob:") || video.querySelector("source")) return;
    released.set(video, { src, time: video.currentTime || 0 });
    video.removeAttribute("src");
    origLoad.call(video); // drops buffered and decoded data
    io && io.observe(video);
  };

  const distanceFromViewport = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return Infinity; // not laid out
    const vh = window.innerHeight || 1;
    if (r.bottom < 0) return -r.bottom / vh;
    if (r.top > vh) return (r.top - vh) / vh;
    return 0;
  };

  // Anything that wants to play a detached video gets its source back first.
  proto.play = function play() {
    if (released.has(this)) restore(this);
    return origPlay.apply(this, arguments);
  };

  window.addEventListener("play", (e) => {
    if (e.target instanceof HTMLMediaElement) lastActive.set(e.target, now());
  }, true);

  const sweep = () => {
    const t = now();
    for (const video of document.getElementsByTagName("video")) {
      if (released.has(video)) continue;
      if (!video.paused || !lastActive.has(video)) {
        lastActive.set(video, t);
        continue;
      }
      if (t - lastActive.get(video) < IDLE_MS) continue;
      if (video.readyState === 0 && video.networkState !== 2) continue; // nothing loaded
      if (distanceFromViewport(video) >= SCREENS_AWAY) release(video);
    }
  };
  setInterval(sweep, SWEEP_MS);
})();
