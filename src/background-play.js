// Runs in the page's own JavaScript context (world: "MAIN") before TikTok's
// scripts load, so TikTok never learns that the tab went to the background.
(() => {
  "use strict";
  if (window.__tiktokBackgroundPlay) return;
  window.__tiktokBackgroundPlay = true;

  const docProto = Document.prototype;
  const realHidden = Object.getOwnPropertyDescriptor(docProto, "hidden").get;

  // 1. Report the page as always visible and focused.
  const defineGetter = (obj, prop, value) => {
    try {
      Object.defineProperty(obj, prop, { configurable: true, enumerable: true, get: () => value });
    } catch (_) {}
  };
  defineGetter(docProto, "hidden", false);
  defineGetter(docProto, "visibilityState", "visible");
  defineGetter(docProto, "webkitHidden", false);
  defineGetter(docProto, "webkitVisibilityState", "visible");
  docProto.hasFocus = function hasFocus() { return true; };

  // 2. Swallow the events that announce the tab was hidden or lost focus.
  //    Registered at document_start in the capture phase on window, so these
  //    listeners run before anything TikTok adds.
  const block = (e) => {
    if (e.target === window || e.target === document) e.stopImmediatePropagation();
  };
  for (const type of ["visibilitychange", "webkitvisibilitychange", "blur"]) {
    window.addEventListener(type, block, true);
  }

  // 3. Safety net: while the tab is really hidden, ignore pause() calls coming
  //    from page scripts, unless the user just pressed a media key / used the
  //    system media controls (those go through navigator.mediaSession).
  let mediaActionAt = 0;
  const ms = navigator.mediaSession;
  if (ms && typeof ms.setActionHandler === "function") {
    const origSetAction = ms.setActionHandler.bind(ms);
    ms.setActionHandler = (action, handler) => origSetAction(action, handler && function (...args) {
      mediaActionAt = Date.now();
      return handler.apply(this, args);
    });
  }
  const isReallyHidden = () => {
    try { return realHidden.call(document); } catch (_) { return false; }
  };
  const origPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function pause() {
    if (isReallyHidden() && Date.now() - mediaActionAt > 1000 && !this.ended) return;
    return origPause.call(this);
  };
})();
