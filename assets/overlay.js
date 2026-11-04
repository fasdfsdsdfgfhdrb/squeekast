/* Squeekast overlay — reads Squeekchain's public telemetry and paints it. */
(() => {
  "use strict";

  const API = "https://api.squeekchain.com";
  const qs = new URLSearchParams(location.search);

  const MODE = (qs.get("o") || "wheel").toLowerCase();
  const BG = qs.get("bg") === "1" ? "1" : "0";
  const SCALE = Math.min(2, Math.max(0.5, parseFloat(qs.get("scale") || "1") || 1));
  const SHOW_LABEL = qs.get("label") !== "0";

  document.body.dataset.bg = BG;
  document.getElementById("stage").style.transform = `scale(${SCALE})`;

  /* ---------------- state ---------------- */
  const S = {
    rpm: 0,
    core: "—",
    block: 0,
    progress: 0,
    round: 0,
    diff: 0,
    supply: 0,
    cap: 0,
    nft: 0,
    staked: 0,
    decimals: 18,
    ok: false,
    at: 0,
  };
  let prevBlock = null;
  let prevCore = null;

  /* ---------------- helpers ---------------- */
  const fmt = (n) => {
    if (!isFinite(n)) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K";
    return String(Math.round(n));
  };
  const num = (v) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
  };
  const base = (v) => num(v) / Math.pow(10, S.decimals);

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

  /* ---------------- data ---------------- */
  async function pullStatus() {
    try {
      const d = await getJSON("/v1/status");
      const m = d.measurement || {};
      const a = (d.builder && d.builder.anchor) || {};
      S.rpm = num(m.rpmMilli) / 1000;
      S.core = (m.coreStatus || "—").toString();
      S.block = num(a.blockHeight);
      S.progress = num(a.blockProgress);
      S.round = num(a.settledThroughRound);
      S.diff = num(a.workPerThousandBlocks);
      S.ok = m.freshness === "online";
      S.at = Date.now();
      onData();
    } catch (e) {
      S.ok = false;
      onData();
    }
  }

  async function pullEconomy() {
    try {
      const d = await getJSON("/v1/economy/state");
      if (d.asset && d.asset.decimals != null) S.decimals = num(d.asset.decimals);
      const sup = d.supply || {};
      S.supply = base(sup.liveSupplyBaseUnits);
      S.cap = base(sup.capBaseUnits);
      S.nft = num((d.nft || {}).live);
      S.staked = base((d.staking || {}).totalStakedBaseUnits);
      onData();
    } catch (e) {
      /* keep last good reading */
    }
  }

  /* ---------------- wheel ---------------- */
  const canvas = document.getElementById("wheel");
  const ctx = canvas.getContext("2d");
  let rot = 0;
  let last = performance.now();
  let dpr = 1;
  let size = 0;

  function fit() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    size = Math.max(120, Math.min(r.width, r.height));
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }

  function dot(x, y, rad, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    const dt = Math.min(0.12, (now - last) / 1000);
    last = now;

    if (!size) fit();
    const w = canvas.width;
    const cx = w / 2;
    const cy = w / 2;
    const R = w * 0.40;

    // wheel advances at the hamster's real rpm
    rot += (S.rpm / 60) * Math.PI * 2 * dt;

    ctx.clearRect(0, 0, w, w);

    const live = S.ok && S.rpm > 0.01;
    const hot = live ? "#f0bb85" : "#b07f52";
    const dim = live ? "rgba(226,168,116,0.22)" : "rgba(176,127,82,0.16)";
    const dotR = w * 0.0105;

    // soft glow behind the wheel
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.35);
    g.addColorStop(0, live ? "rgba(226,168,116,0.16)" : "rgba(176,127,82,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);

    // outer rim: 72 dots, 14-dot comet trail
    const N = 72;
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + rot;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      let trail = ((i - Math.round((rot / (Math.PI * 2)) * N)) % N + N) % N;
      const lit = trail < 14 ? 1 - trail / 14 : 0;
      if (lit > 0) {
        dot(x, y, dotR * (1 + lit * 0.55), hot, 0.3 + lit * 0.7);
      } else {
        dot(x, y, dotR, hot, 0.3);
      }
    }

    // inner ring: counter-rotating, slower
    const N2 = 48;
    const R2 = R * 0.68;
    for (let i = 0; i < N2; i++) {
      const ang = (i / N2) * Math.PI * 2 - rot * 0.45;
      dot(cx + Math.cos(ang) * R2, cy + Math.sin(ang) * R2, dotR * 0.72, dim, 0.9);
    }

    // six spokes
    const spokes = 6;
    for (let s = 0; s < spokes; s++) {
      const ang = (s / spokes) * Math.PI * 2 + rot * 0.9;
      for (let k = 1; k <= 7; k++) {
        const rr = R * (0.16 + (k / 7) * 0.44);
        dot(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, dotR * 0.6, hot, 0.3);
      }
    }

    // hub
    dot(cx, cy, dotR * 2.6, hot, live ? 0.9 : 0.35);

    requestAnimationFrame(draw);
  }

  /* ---------------- ticker ---------------- */
  const T = {
    rpm: document.getElementById("t-rpm"),
    block: document.getElementById("t-block"),
    supply: document.getElementById("t-supply"),
    nft: document.getElementById("t-nft"),
    diff: document.getElementById("t-diff"),
    dot: document.getElementById("t-dot"),
  };

  /* ---------------- alert ---------------- */
  const alertBox = document.getElementById("alert");
  let alertTimer = null;

  function flash(kind, value, sub) {
    document.getElementById("a-k").textContent = kind;
    document.getElementById("a-v").textContent = value;
    document.getElementById("a-s").textContent = sub || "\u00a0";
    alertBox.classList.add("on");
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => alertBox.classList.remove("on"), 6500);
  }

  /* ---------------- paint ---------------- */
  function onData() {
    const stale = !S.ok || Date.now() - S.at > 180000;
    document.body.classList.toggle("stale", stale);

    if (MODE === "ticker") {
      T.rpm.innerHTML = (S.rpm > 0 ? S.rpm.toFixed(1) : "0.0") + "<small>rpm</small>";
      T.rpm.classList.toggle("hot", S.rpm > 0.01);
      T.block.textContent = S.block ? "#" + S.block.toLocaleString("en-US") : "—";
      T.supply.textContent = S.supply ? fmt(S.supply) : "—";
      T.nft.textContent = S.nft ? fmt(S.nft) : "—";
      T.diff.textContent = S.diff ? fmt(S.diff) : "—";
      T.dot.dataset.live = S.ok && S.rpm > 0.01 ? "1" : "0";
    }

    if (MODE === "wheel") {
      const c = document.getElementById("caption");
      c.style.display = SHOW_LABEL ? "block" : "none";
      document.getElementById("caption-state").textContent =
        "· " + (S.rpm > 0.01 ? S.rpm.toFixed(1) + " rpm" : "sleeping");
    }

    if (MODE === "alert") {
      if (prevBlock !== null && S.block > prevBlock) {
        flash("New Squeek block", "#" + S.block.toLocaleString("en-US"), "settled through round " + S.round);
      } else if (prevCore !== null && prevCore !== "RUNNING" && S.core === "RUNNING") {
        flash("Squeektoshi is running", S.rpm.toFixed(1) + " rpm", "the wheel is turning");
      }
    }

    if (S.block) prevBlock = S.block;
    if (S.core !== "—") prevCore = S.core;
  }

  /* ---------------- boot ---------------- */
  const wrap = document.getElementById("wheel-wrap");
  const ticker = document.getElementById("ticker");

  if (MODE === "ticker") {
    wrap.style.display = "none";
    ticker.style.display = "flex";
    document.getElementById("stage").style.alignItems = "center";
  } else if (MODE === "alert") {
    wrap.style.display = "none";
    ticker.style.display = "none";
    document.getElementById("alert").style.display = "flex";
    document.getElementById("alert").classList.remove("on");
  } else {
    ticker.style.display = "none";
  }

  window.addEventListener("resize", () => { size = 0; fit(); });

  if (MODE === "wheel") {
    fit();
    requestAnimationFrame(draw);
  }

  pullStatus();
  pullEconomy();
  setInterval(pullStatus, 5000);
  setInterval(pullEconomy, 20000);
})();
