(() => {
  "use strict";

  // ---------- Physics constants and scale ----------
  const Z_ALPHA = 2;
  const Z_GOLD = 79;
  const K_E2 = 1.439964; // k·e² in MeV·fm
  const M_ALPHA_MEV = 3727.379;
  const E_REF_MEV = 5;
  const R_GOLD_FM = 1.2 * Math.cbrt(197);
  const C_MS = 2.99792458e8;
  let PX_PER_FM = 6 / R_GOLD_FM;
  let NUCLEUS_PX = R_GOLD_FM * PX_PER_FM;
  const V_REF_PX = 190;
  let K_PX = (K_E2 * Z_ALPHA * Z_GOLD / E_REF_MEV) * PX_PER_FM * V_REF_PX * V_REF_PX / 2;
  const MARGIN = 14;
  const BINS = 18;
  const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const stage = $("stage");
  const ctx = stage.getContext("2d");
  const hist = $("hist");
  const hctx = hist.getContext("2d");
  const speedInput = $("speed");
  const rateInput = $("rate");
  const showTheory = $("showTheory");
  const pauseBtn = $("pause");
  const resetBtn = $("reset");
  const themeBtn = $("theme");
  const themeLabel = $("themeLabel");
  const runState = $("runState");

  let W = 0, H = 0, HW = 0, HH = 0, dpr = 1;
  let energy = Number(speedInput.value);
  let speedFactor = Math.sqrt(energy / E_REF_MEV);
  let rate = Number(rateInput.value);
  let paused = false;
  let particles = [];
  let flashes = [];
  let spawnTimer = 0;
  let time = 0;
  let stats, measured, predicted;
  let theoryPaths = [];

  function closestApproachFm(E) {
    return K_E2 * Z_ALPHA * Z_GOLD / E;
  }

  function speedFractionC(E) {
    const gamma = 1 + E / M_ALPHA_MEV;
    return Math.sqrt(1 - 1 / (gamma * gamma));
  }

  const cx = () => W / 2;
  const cy = () => H / 2;
  const energyMeV = () => energy;

  function resetStats() {
    stats = { total: 0, def5: 0, back: 0, devSum: 0, maxErr: 0 };
    measured = new Array(BINS).fill(0);
    predicted = new Array(BINS).fill(0);
  }

  function updateScale() {
    const scale = Math.min(6 / R_GOLD_FM, Math.min(W * .32, H * .35) / closestApproachFm(energy));
    if (Math.abs(scale - PX_PER_FM) > 1e-8) { particles = []; flashes = []; resetStats(); }
    PX_PER_FM = scale; NUCLEUS_PX = R_GOLD_FM * scale;
    K_PX = (K_E2 * Z_ALPHA * Z_GOLD / E_REF_MEV) * scale * V_REF_PX * V_REF_PX / 2;
  }
  function resize() {
    const oldW = W, oldH = H;
    const stageRect = stage.getBoundingClientRect();
    const histRect = hist.getBoundingClientRect();
    W = stageRect.width;
    H = stageRect.height;
    HW = histRect.width;
    HH = histRect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    stage.width = Math.round(W * dpr);
    stage.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hist.width = Math.round(HW * dpr);
    hist.height = Math.round(HH * dpr);
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (oldW && oldH) {
      const shiftX = cx() - oldW / 2;
      const shiftY = cy() - oldH / 2;
      for (const p of particles) {
        p.x += shiftX;
        p.y += shiftY;
        for (let i = 0; i < p.trail.length; i += 2) {
          p.trail[i] += shiftX;
          p.trail[i + 1] += shiftY;
        }
      }
      for (const f of flashes) { f.x += shiftX; f.y += shiftY; }
    }
    updateScale();
    rebuildTheoryPaths();
  }

  window.addEventListener("resize", resize, { passive: true });

  function spawn() {
    const v = V_REF_PX * speedFactor;
    const visibleHalfBeam = Math.max(1, H / 2 - MARGIN), launchX = -cx() - 6;
    const correction = 4 * K_PX / (v*v) / (Math.hypot(launchX,visibleHalfBeam) - launchX);
    const halfBeam = visibleHalfBeam * (1 + Math.sqrt(Math.max(0, 1-correction))) / 2;
    const b = (Math.random() * 2 - 1) * halfBeam;
    const dPx = 2 * K_PX / (v * v);
    const impact = Math.max(Math.abs(b), 1e-9);
    const initial = DecayPhysics.coulombIncoming(launchX, b, v, K_PX);
    const launchRadius = Math.hypot(initial.x, initial.y);

    particles.push({
      x: -6,
      y: cy() + initial.y,
      vx: initial.vx,
      vy: initial.vy,
      v0: v,
      b,
      dPx,
      halfBeam,
      launchRadius,
      theoryTheta: 2 * Math.atan(dPx / (2 * impact)),
      trail: [],
    });
  }

  // Uniformly charged sphere inside, inverse-square Coulomb field outside.
  function accel(dx, dy, out) {
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);
    const a = r >= NUCLEUS_PX
      ? K_PX / r2
      : K_PX * r / (NUCLEUS_PX * NUCLEUS_PX * NUCLEUS_PX);
    const inv = r > 1e-9 ? 1 / r : 0;
    out[0] = a * dx * inv;
    out[1] = a * dy * inv;
  }

  // Velocity Verlet with adaptive steps capped by travel distance and radius.
  const aTmp = [0, 0];
  function integrate(p, dt) {
    let remaining = dt;
    let dx = p.x - cx(), dy = p.y - cy();
    accel(dx, dy, aTmp);
    let ax = aTmp[0], ay = aTmp[1];
    let guard = 0;
    while (remaining > 1e-9 && guard++ < 4000) {
      const r = Math.hypot(dx, dy);
      const v = Math.hypot(p.vx, p.vy) || 1e-6;
      const a = Math.hypot(ax, ay) || 1e-9;
      let h = Math.min(
        0.6 / v,
        0.04 * r / v,
        Math.sqrt(0.08 * Math.max(r, 0.5) / a),
        remaining,
      );
      h = Math.min(remaining, Math.max(h, 1e-6));
      p.vx += 0.5 * ax * h;
      p.vy += 0.5 * ay * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
      dx = p.x - cx();
      dy = p.y - cy();
      accel(dx, dy, aTmp);
      ax = aTmp[0];
      ay = aTmp[1];
      p.vx += 0.5 * ax * h;
      p.vy += 0.5 * ay * h;
      remaining -= h;
    }
  }

  function predictedFraction(p, thetaDeg) {
    if (thetaDeg <= 0) return 1;
    const theta = thetaDeg * Math.PI / 180;
    const bMax = (p.dPx / 2) / Math.tan(theta / 2);
    return Math.min(1, bMax / p.halfBeam);
  }

  function detect(p) {
    const theta = DecayPhysics.coulombOutgoing(p.x-cx(), p.y-cy(), p.vx, p.vy, K_PX);
    const deg = Math.abs(theta) * 180 / Math.PI;
    stats.total++;
    if (deg > 5) stats.def5++;
    if (deg > 90) stats.back++;
    stats.devSum += Math.abs(deg - p.theoryTheta * 180 / Math.PI);

    // Coulomb repulsion has positive potential energy: E = ½mv² + kq₁q₂/r.
    const vExit = Math.hypot(p.vx, p.vy);
    const dist = Math.max(1e-9, Math.hypot(p.x - cx(), p.y - cy()));
    const eOut = 0.5 * vExit * vExit + K_PX / dist;
    const eIn = 0.5 * p.v0 * p.v0;
    stats.maxErr = Math.max(stats.maxErr, Math.abs(eOut - eIn) / Math.max(Math.abs(eIn), 1e-9));

    measured[Math.min(BINS - 1, Math.floor(deg / (180 / BINS)))]++;
    for (let i = 0; i < BINS; i++) {
      const lo = i * 180 / BINS;
      const hi = (i + 1) * 180 / BINS;
      predicted[i] += predictedFraction(p, lo) - (i === BINS - 1 ? 0 : predictedFraction(p, hi));
    }
    flashes.push({
      x: Math.min(W, Math.max(0, p.x)),
      y: Math.min(H, Math.max(0, p.y)),
      t: 0,
      deg,
    });
  }

  function step(dt) {
    time += dt;
    for (const p of particles) {
      integrate(p, dt);
      p.trail.push(p.x, p.y);
      if (p.trail.length > 90) p.trail.splice(0, 2);
    }
    const keep = [];
    for (const p of particles) {
      const out = p.x > W + 2 || p.x < -8 || p.y < -2 || p.y > H + 2;
      if (out) detect(p); // Include alpha particles that scatter back toward the source.
      else keep.push(p);
    }
    particles = keep;
    for (const f of flashes) f.t += dt;
    flashes = flashes.filter((f) => f.t < 0.9);
  }

  // ---------- Canvas rendering ----------
  function angleColor(deg, alpha) {
    const t = Math.min(1, deg / 90);
    const r = Math.round(170 + 85 * Math.min(1, t * 2));
    const g = Math.round(215 - 140 * t);
    const b = Math.round(255 - 215 * Math.min(1, t * 1.5));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawBackground() {
    const gradient = ctx.createRadialGradient(cx(), cy(), 0, cx(), cy(), Math.max(W, H) * 0.72);
    gradient.addColorStop(0, "#152522");
    gradient.addColorStop(1, "#07100f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const gridStep = 100 * PX_PER_FM;
    ctx.strokeStyle = "rgba(156,190,170,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = cx() % gridStep; x < W; x += gridStep) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = cy() % gridStep; y < H; y += gridStep) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = "rgba(180,206,187,0.22)";
    ctx.beginPath();
    ctx.moveTo(0, cy());
    ctx.lineTo(W, cy());
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(132,205,161,0.16)";
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, W - 5, H - 5);

    const barPx = 200 * PX_PER_FM;
    ctx.strokeStyle = "rgba(230,236,223,0.65)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(20, H - 22); ctx.lineTo(20 + barPx, H - 22);
    ctx.moveTo(20, H - 27); ctx.lineTo(20, H - 17);
    ctx.moveTo(20 + barPx, H - 27); ctx.lineTo(20 + barPx, H - 17);
    ctx.stroke();
    ctx.fillStyle = "rgba(230,236,223,0.75)";
    ctx.font = `10px ${MONO}`;
    ctx.fillText("200 fm", 20, H - 31);
  }

  function buildTheoryPath(b, sign, v, maxSteps) {
    let x = -6;
    const initial = DecayPhysics.coulombIncoming(-cx()-6, sign*b, v, K_PX);
    let y = cy() + initial.y;
    let vx = initial.vx, vy = initial.vy;
    const points = [x, y];
    for (let i = 0; i < maxSteps; i++) {
      const dx = x - cx(), dy = y - cy(), r = Math.hypot(dx, dy);
      const a = r >= NUCLEUS_PX ? K_PX / (r * r) : K_PX * r / (NUCLEUS_PX ** 3);
      const sp = Math.hypot(vx, vy) || 1e-6;
      const h = Math.min(1.0 / sp, 0.04 * r / sp);
      vx += 0.5 * a * dx / r * h;
      vy += 0.5 * a * dy / r * h;
      x += vx * h;
      y += vy * h;
      const dx2 = x - cx(), dy2 = y - cy(), r2 = Math.hypot(dx2, dy2);
      const a2 = r2 >= NUCLEUS_PX ? K_PX / (r2 * r2) : K_PX * r2 / (NUCLEUS_PX ** 3);
      vx += 0.5 * a2 * dx2 / r2 * h;
      vy += 0.5 * a2 * dy2 / r2 * h;
      points.push(x, y);
      if (x > W || x < -8 || y < 0 || y > H) break;
    }
    return points;
  }

  function rebuildTheoryPaths() {
    if (!ctx || !W || !H) return;
    const v = V_REF_PX * speedFactor;
    const d = 2 * K_PX / (v * v);
    const impacts = [0.25, 0.5, 1, 2, 4].map((m) => m * d / 2).filter((b) => b < H / 2 - MARGIN);
    theoryPaths = [];
    for (const b of impacts) {
      for (const sign of [1, -1]) theoryPaths.push(buildTheoryPath(b, sign, v, 4000));
    }
  }

  function drawTheoryPaths() {
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(117,184,255,0.48)";
    for (const points of theoryPaths) {
      if (points.length < 4) continue;
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNucleus() {
    const v = V_REF_PX * speedFactor;
    const d = 2 * K_PX / (v * v);
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = "rgba(240,190,72,0.52)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx(), cy(), d, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(251,218,137,0.9)";
    ctx.font = `10px ${MONO}`;
    ctx.fillText(`d = ${closestApproachFm(energyMeV()).toFixed(1)} fm`, Math.min(W - 122, cx() + d * 0.65 + 6), Math.max(20, cy() - d * 0.72 - 6));
    ctx.restore();

    const pulse = 0.85 + 0.15 * Math.sin(time * 2.2);
    const halo = ctx.createRadialGradient(cx(), cy(), NUCLEUS_PX * 0.5, cx(), cy(), NUCLEUS_PX * 9 * pulse);
    halo.addColorStop(0, "rgba(255,208,104,0.65)");
    halo.addColorStop(0.25, "rgba(255,178,58,0.2)");
    halo.addColorStop(1, "rgba(255,160,40,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx(), cy(), NUCLEUS_PX * 9, 0, Math.PI * 2);
    ctx.fill();

    const nucleus = ctx.createRadialGradient(cx() - 2, cy() - 2, 0.5, cx(), cy(), NUCLEUS_PX);
    nucleus.addColorStop(0, "#fff5cb");
    nucleus.addColorStop(0.45, "#f5c74f");
    nucleus.addColorStop(1, "#a96b20");
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#f0b429";
    ctx.fillStyle = nucleus;
    ctx.beginPath();
    ctx.arc(cx(), cy(), NUCLEUS_PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,235,184,0.95)";
    ctx.font = `10px ${MONO}`;
    ctx.fillText("Au +79e", cx() + 11, cy() + 4);
  }

  function drawParticles() {
    ctx.lineCap = "round";
    for (const p of particles) {
      const deg = Math.abs(Math.atan2(p.vy, p.vx)) * 180 / Math.PI;
      const n = p.trail.length / 2;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        ctx.strokeStyle = angleColor(deg, t * 0.62);
        ctx.lineWidth = 0.6 + 1.5 * t;
        ctx.beginPath();
        ctx.moveTo(p.trail[(i - 1) * 2], p.trail[(i - 1) * 2 + 1]);
        ctx.lineTo(p.trail[i * 2], p.trail[i * 2 + 1]);
        ctx.stroke();
      }
      ctx.shadowBlur = 9;
      ctx.shadowColor = angleColor(deg, 1);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawFlashes() {
    for (const f of flashes) {
      const alpha = 1 - f.t / 0.9;
      const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 20);
      gradient.addColorStop(0, `rgba(190,255,220,${0.85 * alpha})`);
      gradient.addColorStop(1, "rgba(190,255,220,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 25, 0, Math.PI * 2);
      ctx.fill();
      if (f.deg > 5) {
        ctx.fillStyle = `rgba(235,255,240,${alpha})`;
        ctx.font = `10px ${MONO}`;
        ctx.fillText(`${f.deg.toFixed(0)}°`, Math.min(W - 38, Math.max(7, f.x + 9)), Math.min(H - 8, Math.max(16, f.y - 8)));
      }
    }
  }

  function draw() {
    drawBackground();
    if (showTheory.checked) drawTheoryPaths();
    drawNucleus();
    drawParticles();
    drawFlashes();
  }

  function drawHist() {
    if (!HW || !HH) return;
    const style = getComputedStyle(root);
    const muted = style.getPropertyValue("--muted").trim();
    const line = style.getPropertyValue("--line").trim();
    const gold = style.getPropertyValue("--gold").trim();
    const blue = style.getPropertyValue("--blue").trim();
    hctx.clearRect(0, 0, HW, HH);
    const padL = 34, padT = 8, padB = 22;
    const w = (HW - padL - 4) / BINS;
    const h0 = HH - padB;
    const maxV = Math.max(1, ...measured, ...predicted);
    const scale = (v) => (v <= 0 ? 0 : Math.log10(v + 1) / Math.log10(maxV + 1)) * (h0 - padT);

    hctx.font = `9px ${MONO}`;
    hctx.fillStyle = muted;
    hctx.strokeStyle = line;
    hctx.lineWidth = 1;
    for (let value = 1; value <= maxV; value *= 10) {
      const y = Math.round(h0 - scale(value)) + 0.5;
      hctx.globalAlpha = 0.55;
      hctx.beginPath();
      hctx.moveTo(padL, y);
      hctx.lineTo(HW, y);
      hctx.stroke();
      hctx.globalAlpha = 1;
      hctx.fillText(String(value), 2, y + 3);
    }

    for (let i = 0; i < BINS; i++) {
      const x = padL + i * w;
      const hm = scale(measured[i]);
      const hp = scale(predicted[i]);
      hctx.globalAlpha = 0.92;
      hctx.fillStyle = gold;
      hctx.fillRect(x + 1, h0 - hm, w * 0.55, hm);
      hctx.globalAlpha = 0.84;
      hctx.fillStyle = blue;
      hctx.fillRect(x + 1 + w * 0.55, h0 - hp, w * 0.4, hp);
    }
    hctx.globalAlpha = 1;
    hctx.fillStyle = muted;
    for (let i = 0; i < BINS; i += 3) hctx.fillText(`${i * 10}°`, padL + i * w, HH - 6);
    hctx.textAlign = "right";
    hctx.fillText("180°", HW, HH - 6);
    hctx.textAlign = "left";
    hctx.strokeStyle = line;
    hctx.beginPath();
    hctx.moveTo(padL, h0 + 0.5);
    hctx.lineTo(HW, h0 + 0.5);
    hctx.stroke();
  }

  function updateReadouts() {
    const E = energyMeV();
    const beta = speedFractionC(E);
    $("kE").textContent = `${E.toFixed(2)} MeV`;
    $("kV").textContent = `${(beta * C_MS / 1e6).toFixed(1)} Mm/s (${(beta * 100).toFixed(2)}% c)`;
    $("kD").textContent = `${closestApproachFm(E).toFixed(1)} fm`;
    const err = stats.maxErr * 100;
    const errEl = $("kErr");
    errEl.textContent = stats.total ? `max drift ${err.toFixed(3)}%` : "Awaiting detection";
    errEl.className = stats.total && err > 0.5 ? "warn" : "";
    $("sTotal").textContent = String(stats.total);
    const percent = (n) => stats.total ? ` (${(100 * n / stats.total).toFixed(1)}%)` : " (—)";
    $("sDef").innerHTML = `${stats.def5}<small>${percent(stats.def5)}</small>`;
    $("sBack").innerHTML = `${stats.back}<small>${percent(stats.back)}</small>`;
    $("sDev").textContent = stats.total ? `${(stats.devSum / stats.total).toFixed(2)}°` : "—";
    speedInput.setAttribute("aria-valuetext", `${E.toFixed(1)} MeV`);
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    themeLabel.textContent = theme === "dark" ? "Light mode" : "Dark mode";
    themeBtn.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
  }

  themeBtn.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch (_) { /* Storage can be disabled. */ }
  });

  function syncSliders() {
    rate = Number(rateInput.value);
    $("speedValue").textContent = `${energy.toFixed(1)} MeV`;
    $("rateValue").textContent = `${rate} α/s`;
  }

  speedInput.addEventListener("input", () => {
    const nextEnergy = Number(speedInput.value);
    if (nextEnergy !== energy) {
      energy = nextEnergy;
      speedFactor = Math.sqrt(energy / E_REF_MEV);
      resetStats();
      particles = [];
      flashes = [];
      spawnTimer = 0;
      updateScale();
      rebuildTheoryPaths();
    }
    syncSliders();
  });
  rateInput.addEventListener("input", syncSliders);
  showTheory.addEventListener("change", () => { showTheory.setAttribute("aria-checked", String(showTheory.checked)); });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    const label = pauseBtn.querySelector("span:last-child");
    const glyph = pauseBtn.querySelector(".pause-glyph");
    label.textContent = paused ? "Resume" : "Pause";
    glyph.textContent = paused ? "▶" : "Ⅱ";
    runState.textContent = paused ? "PAUSED" : "LIVE";
  });

  resetBtn.addEventListener("click", () => {
    resetStats();
    particles = [];
    flashes = [];
    spawnTimer = 0;
  });

  // ---------- Animation loop ----------
  resetStats();
  syncSliders();
  setTheme(root.dataset.theme === "dark" ? "dark" : "light");
  resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused && !document.hidden) {
      spawnTimer += dt;
      const interval = 1 / Math.max(1, rate);
      while (spawnTimer >= interval) {
        spawnTimer -= interval;
        spawn();
      }
      step(dt);
    }
    draw();
    drawHist();
    updateReadouts();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

