/* Squeekast landing — live telemetry + overlay URL builder. */
(() => {
  "use strict";

  const API = "https://api.squeekchain.com";
  const el = (id) => document.getElementById(id);

  const fmt = (n) => {
    if (!isFinite(n) || n === 0) return "0";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K";
    return String(Math.round(n));
  };
  const num = (v) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
  };

  async function getJSON(path) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(API + path, { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  function setPill(state, text) {
    const pill = el("conn-pill");
    pill.dataset.state = state;
    el("conn-text").textContent = text;
  }

  let decimals = 18;

  async function tick() {
    try {
      const s = await getJSON("/v1/status");
      const m = s.measurement || {};
      const a = (s.builder && s.builder.anchor) || {};
      const rpm = num(m.rpmMilli) / 1000;

      el("s-rpm").textContent = rpm > 0 ? rpm.toFixed(1) : "0.0";
      el("s-core").textContent = "core status " + (m.coreStatus || "—").toLowerCase();
      el("s-block").textContent = a.blockHeight ? Number(a.blockHeight).toLocaleString("en-US") : "—";
      el("s-progress").textContent =
        "round " + (a.settledThroughRound || "—") + " · diff " + fmt(num(a.workPerThousandBlocks)) + "/1k";

      const fresh = m.freshness === "online";
      setPill(fresh ? (rpm > 0 ? "live" : "idle") : "stale",
        fresh ? (rpm > 0 ? "wheel running" : "wheel idle") : "telemetry stale");
    } catch (e) {
      setPill("stale", "api unreachable");
    }

    try {
      const e = await getJSON("/v1/economy/state");
      if (e.asset && e.asset.decimals != null) decimals = num(e.asset.decimals);
      const sup = e.supply || {};
      const div = Math.pow(10, decimals);
      const live = num(sup.liveSupplyBaseUnits) / div;
      const cap = num(sup.capBaseUnits) / div;
      el("s-supply").textContent = live ? fmt(live) : "—";
      el("s-cap").textContent = cap ? "of " + fmt(cap) + " cap" : "—";
      const nft = (e.nft || {}).live;
      const staked = num((e.staking || {}).totalStakedBaseUnits) / div;
      el("s-nft").textContent = nft ? Number(nft).toLocaleString("en-US") : "—";
      el("s-staked").textContent = staked ? fmt(staked) + " SQK staked" : "—";
    } catch (e) { /* keep last */ }
  }

  /* ---------------- builder ---------------- */
  const cfg = { o: "wheel", bg: "0", scale: "1", label: "1" };

  function buildURL() {
    const p = new URLSearchParams();
    p.set("o", cfg.o);
    p.set("bg", cfg.bg);
    if (cfg.scale !== "1") p.set("scale", cfg.scale);
    if (cfg.label === "0") p.set("label", "0");
    const base = location.href.replace(/index\.html$/, "").replace(/[^/]*$/, "");
    return base + "overlay.html?" + p.toString();
  }

  function sync() {
    const u = buildURL();
    el("out-url").value = u;
    const frame = el("preview");
    if (frame.getAttribute("src") !== u) frame.setAttribute("src", u);
  }

  function bindSeg(id, key, cast) {
    const box = el(id);
    box.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-v]");
      if (!btn) return;
      [...box.querySelectorAll("button")].forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      cfg[key] = cast ? cast(btn.dataset.v) : btn.dataset.v;
      sync();
    });
  }

  bindSeg("seg-mode", "o");
  bindSeg("seg-bg", "bg");
  bindSeg("seg-scale", "scale");

  el("chk-label").addEventListener("change", (e) => {
    cfg.label = e.target.checked ? "1" : "0";
    sync();
  });

  el("btn-copy").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(el("out-url").value);
    } catch (_) {
      el("out-url").select();
      document.execCommand("copy");
    }
    btn.dataset.done = "1";
    btn.textContent = "Copied";
    setTimeout(() => { btn.dataset.done = "0"; btn.textContent = "Copy"; }, 1600);
  });

  sync();
  tick();
  setInterval(tick, 10000);
})();
