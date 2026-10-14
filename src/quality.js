// Always pick the best playable stream TikTok offers for each video.
//
// TikTok's video JSON (API responses and the page's embedded data) lists every
// encoding of a video in `video.bitrateInfo`, but the web player gets handed a
// mid-quality `playAddr`. We rewrite each video entry so the player only sees
// the best H.264 stream: H.264 always plays in Firefox and always carries the
// audio track (some H.265 "hvc1" streams are video-only, and "bytevc2" is a
// ByteDance codec no browser can play).
(() => {
  "use strict";
  if (window.__tiktokBestQuality) return;
  window.__tiktokBestQuality = true;

  const MARKER = '"bitrateInfo"';

  const resolutionOf = (b) => {
    const key = (b.PlayAddr && b.PlayAddr.UrlKey) || "";
    const fromKey = key.match(/_(\d{3,4})p_/);
    if (fromKey) return +fromKey[1];
    const fromGear = (b.GearName || "").match(/_(\d{3,4})(?:_|$)/);
    if (fromGear) return +fromGear[1];
    const w = b.PlayAddr && +b.PlayAddr.Width, h = b.PlayAddr && +b.PlayAddr.Height;
    return w && h ? Math.min(w, h) : 0;
  };

  const isH264 = (b) => {
    const key = ((b.PlayAddr && b.PlayAddr.UrlKey) || "").toLowerCase();
    const codec = String(b.CodecType || "").toLowerCase();
    if (/bytevc|265|hevc|hvc1/.test(key + " " + codec)) return false;
    return codec.includes("264") || key.includes("_h264_") || (!codec && !key.includes("bytevc"));
  };

  const playableUrls = (b) =>
    ((b.PlayAddr && b.PlayAddr.UrlList) || []).filter(
      (u) => typeof u === "string" && u && !u.includes("hvc1"));

  const pickBest = (list) => {
    let best = null, bestRes = -1, bestRate = -1;
    for (const b of list) {
      if (!b || !isH264(b) || !playableUrls(b).length) continue;
      const res = resolutionOf(b), rate = +b.Bitrate || 0;
      if (res > bestRes || (res === bestRes && rate > bestRate)) {
        best = b; bestRes = res; bestRate = rate;
      }
    }
    return best;
  };

  const upgradeVideo = (video) => {
    if (video.__bestQuality) return;
    const best = pickBest(video.bitrateInfo);
    if (!best) return;
    const urls = playableUrls(best);
    const url = urls[0];

    if (typeof video.playAddr === "string") video.playAddr = url;
    else if (Array.isArray(video.playAddr)) {
      video.playAddr = video.playAddr.length
        ? [{ ...video.playAddr[0], src: url }]
        : [{ src: url }];
    } else if (video.playAddr == null) video.playAddr = url;

    if (video.PlayAddrStruct && Array.isArray(video.PlayAddrStruct.UrlList)) {
      video.PlayAddrStruct = { ...video.PlayAddrStruct, ...best.PlayAddr, UrlList: urls };
    }
    // Leave only the chosen stream so the player's own quality switching
    // can't fall back to a lower one.
    video.bitrateInfo = [best];
    if (+best.Bitrate) video.bitrate = +best.Bitrate;
    try { Object.defineProperty(video, "__bestQuality", { value: true }); } catch (_) {}
  };

  const walk = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 14) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (Array.isArray(node.bitrateInfo) && node.bitrateInfo.length) {
      try { upgradeVideo(node); } catch (_) {}
    }
    for (const k in node) {
      const v = node[k];
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  };
  const patch = (data) => { try { walk(data, 0); } catch (_) {} return data; };

  // 1. JSON.parse: covers the embedded page data and responses read as text.
  const origParse = JSON.parse;
  JSON.parse = function parse(text, reviver) {
    const result = origParse.call(this, text, reviver);
    if (typeof text === "string" && text.length > 200 && text.includes(MARKER)) patch(result);
    return result;
  };

  // 2. fetch(): Response.json() parses natively, without JSON.parse.
  const origJson = Response.prototype.json;
  Response.prototype.json = function json() {
    return origJson.call(this).then(patch);
  };

  // 3. XMLHttpRequest with responseType "json".
  const respDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "response");
  const patched = new WeakSet();
  Object.defineProperty(XMLHttpRequest.prototype, "response", {
    configurable: true,
    enumerable: respDesc.enumerable,
    get() {
      const value = respDesc.get.call(this);
      if (this.responseType === "json" && value && typeof value === "object" && !patched.has(value)) {
        patched.add(value);
        patch(value);
      }
      return value;
    },
  });
})();
