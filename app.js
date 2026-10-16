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
  const PX_PER_FM = 6 / R_GOLD_FM;
  const NUCLEUS_PX = R_GOLD_FM * PX_PER_FM;
  const V_REF_PX = 190;
  const K_PX = (K_E2 * Z_ALPHA * Z_GOLD / E_REF_MEV) * PX_PER_FM * V_REF_PX * V_REF_PX / 2;
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
    rebuildTheoryPaths();
  }

  window.addEventListener("resize", resize, { passive: true });

  function spawn() {
    const v = V_REF_PX * speedFactor;
    const halfBeam = Math.max(1, H / 2 - MARGIN);
    const b = (Math.random() * 2 - 1) * halfBeam;
    const dPx = 2 * K_PX / (v * v);
    const impact = Math.max(Math.abs(b), 1e-9);
    const launchRadius = Math.hypot(cx() + 6, b);

    particles.push({
      x: -6,
      y: cy() + b,
      vx: v,
      vy: 0,
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
    const theta = Math.atan2(p.vy, p.vx);
    const deg = Math.abs(theta) * 180 / Math.PI;
    stats.total++;
    if (deg > 5) stats.def5++;
    if (deg > 90) stats.back++;
    stats.devSum += Math.abs(deg - p.theoryTheta * 180 / Math.PI);

    // Coulomb repulsion has positive potential energy: E = ½mv² + kq₁q₂/r.
    const vExit = Math.hypot(p.vx, p.vy);
    const dist = Math.max(1e-9, Math.hypot(p.x - cx(), p.y - cy()));
    const eOut = 0.5 * vExit * vExit + K_PX / dist;
    const eIn = 0.5 * p.v0 * p.v0 + K_PX / p.launchRadius;
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
    let y = cy() + sign * b;
    let vx = v, vy = 0;
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
    if (!paused) {
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

// ---------- Radioactive decay teaching lab ----------
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const elementData = [
    ["H","Hydrogen"],["He","Helium"],["Li","Lithium"],["Be","Beryllium"],["B","Boron"],["C","Carbon"],["N","Nitrogen"],["O","Oxygen"],["F","Fluorine"],["Ne","Neon"],
    ["Na","Sodium"],["Mg","Magnesium"],["Al","Aluminium"],["Si","Silicon"],["P","Phosphorus"],["S","Sulfur"],["Cl","Chlorine"],["Ar","Argon"],["K","Potassium"],["Ca","Calcium"],
    ["Sc","Scandium"],["Ti","Titanium"],["V","Vanadium"],["Cr","Chromium"],["Mn","Manganese"],["Fe","Iron"],["Co","Cobalt"],["Ni","Nickel"],["Cu","Copper"],["Zn","Zinc"],
    ["Ga","Gallium"],["Ge","Germanium"],["As","Arsenic"],["Se","Selenium"],["Br","Bromine"],["Kr","Krypton"],["Rb","Rubidium"],["Sr","Strontium"],["Y","Yttrium"],["Zr","Zirconium"],
    ["Nb","Niobium"],["Mo","Molybdenum"],["Tc","Technetium"],["Ru","Ruthenium"],["Rh","Rhodium"],["Pd","Palladium"],["Ag","Silver"],["Cd","Cadmium"],["In","Indium"],["Sn","Tin"],
    ["Sb","Antimony"],["Te","Tellurium"],["I","Iodine"],["Xe","Xenon"],["Cs","Caesium"],["Ba","Barium"],["La","Lanthanum"],["Ce","Cerium"],["Pr","Praseodymium"],["Nd","Neodymium"],
    ["Pm","Promethium"],["Sm","Samarium"],["Eu","Europium"],["Gd","Gadolinium"],["Tb","Terbium"],["Dy","Dysprosium"],["Ho","Holmium"],["Er","Erbium"],["Tm","Thulium"],["Yb","Ytterbium"],
    ["Lu","Lutetium"],["Hf","Hafnium"],["Ta","Tantalum"],["W","Tungsten"],["Re","Rhenium"],["Os","Osmium"],["Ir","Iridium"],["Pt","Platinum"],["Au","Gold"],["Hg","Mercury"],
    ["Tl","Thallium"],["Pb","Lead"],["Bi","Bismuth"],["Po","Polonium"],["At","Astatine"],["Rn","Radon"],["Fr","Francium"],["Ra","Radium"],["Ac","Actinium"],["Th","Thorium"],
    ["Pa","Protactinium"],["U","Uranium"],["Np","Neptunium"],["Pu","Plutonium"],["Am","Americium"],["Cm","Curium"],["Bk","Berkelium"],["Cf","Californium"],["Es","Einsteinium"],["Fm","Fermium"],
    ["Md","Mendelevium"],["No","Nobelium"],["Lr","Lawrencium"],["Rf","Rutherfordium"],["Db","Dubnium"],["Sg","Seaborgium"],["Bh","Bohrium"],["Hs","Hassium"],["Mt","Meitnerium"],["Ds","Darmstadtium"],
    ["Rg","Roentgenium"],["Cn","Copernicium"],["Nh","Nihonium"],["Fl","Flerovium"],["Mc","Moscovium"],["Lv","Livermorium"],["Ts","Tennessine"],["Og","Oganesson"]
  ];
  const modes = {
    alpha: { label: "α", name: "alpha", color: "#dfa820", dz: -2, dn: -2 },
    betaMinus: { label: "β⁻", name: "beta minus", color: "#7baee3", dz: 1, dn: -1 },
    betaPlus: { label: "β⁺", name: "beta plus", color: "#d184ad", dz: -1, dn: 1 },
    gamma: { label: "γ", name: "gamma", color: "#79ad83", dz: 0, dn: 0 }
  };
  const presets = {
    alpha: [{ value: "po210", label: "Polonium-210 → lead-206 + alpha", z: 84, n: 126, q: 5.40753, halfLife: 138.3763, halfLifeUnit: "d", source: "https://www.nndc.bnl.gov/ensnds/206/Pb/a_decay.pdf" }],
    betaMinus: [{ value: "c14", label: "Carbon-14 → nitrogen-14 + β⁻", z: 6, n: 8, q: 0.156475, halfLife: 5700, halfLifeUnit: "y", source: "https://www.nndc.bnl.gov/nudat3/getdecaydataset.jsp?dsid=14c+bM+decay&nucleus=14N" }],
    betaPlus: [{ value: "f18", label: "Fluorine-18 → oxygen-18 + β⁺", z: 9, n: 9, q: 0.63350, qNote: "The evaluated parent–daughter mass difference is 1.65550 MeV; β⁺ emission subtracts 2mₑ, leaving 0.63350 MeV available.", halfLife: 109.77, halfLifeUnit: "min", source: "https://www.nndc.bnl.gov/ensnds/18/O/ec_decay.pdf" }],
    gamma: [{ value: "tc99m", label: "Technetium-99m → technetium-99 + γ", z: 43, n: 56, energy: 140.5, halfLife: 6.0072, halfLifeUnit: "h" }]
  };
  const modeButtons = [...document.querySelectorAll(".decay-mode")];
  const zInput = $("protonCount"), nInput = $("neutronCount");
  const elementSelect = $("elementSelect"), presetSelect = $("decayPreset");
  const decayCanvas = $("decayStage"), decayCtx = decayCanvas.getContext("2d");
  const halfLifeCanvas = $("halfLifeChart"), halfCtx = halfLifeCanvas.getContext("2d");
  const decayCloudCanvas = $("decayCloud"), decayCloudCtx = decayCloudCanvas.getContext("2d");
  let mode = "alpha", eventProgress = 0, eventRunning = false, eventComplete = false;
  let eventLast = 0, loopTimeout = null, eventCount = 0, randomRemaining = 0;
  let currentFrame = 0, lastDecaySize = "", lastClockSize = "", lastCloudSize = "";
  let decayTimes = [], cloudParticles = [], clockPlaying = false, lastMapComposition = null;

  const elementSymbol = (z) => elementData[Math.max(0, Math.min(elementData.length - 1, z - 1))][0];
  const elementName = (z) => elementData[Math.max(0, Math.min(elementData.length - 1, z - 1))][1];
  const parent = () => ({ z: Number(zInput.value), n: Number(nInput.value), a: Number(zInput.value) + Number(nInput.value) });
  const daughter = (m = mode) => {
    const p = parent(), spec = modes[m];
    return { z: p.z + spec.dz, n: p.n + spec.dn, a: p.a + spec.dz + spec.dn };
  };
  const numberText = (n) => n < 0 ? `−${Math.abs(n)}` : n > 0 ? `+${n}` : "0";

  elementData.forEach(([symbol, name], i) => {
    const option = document.createElement("option");
    option.value = String(i + 1); option.textContent = `${name} (${symbol})`;
    elementSelect.append(option);
  });

  function setMode(next, keepComposition = true) {
    mode = next;
    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    $("gammaEnergyControl").hidden = mode !== "gamma";
    if (keepComposition) populatePresets(true);
    clearEvent();
    updateDecayReadouts();
  }

  function populatePresets(keepCurrent) {
    const old = keepCurrent ? "custom" : "";
    presetSelect.replaceChildren();
    const custom = document.createElement("option"); custom.value = "custom"; custom.textContent = "Current composition"; presetSelect.append(custom);
    (presets[mode] || []).forEach((preset) => {
      const option = document.createElement("option"); option.value = preset.value; option.textContent = preset.label; presetSelect.append(option);
    });
    presetSelect.value = old || (presets[mode]?.[0]?.value ?? "custom");
    if (!keepCurrent && presetSelect.value !== "custom") applyPreset(presetSelect.value);
  }

  function applyPreset(value) {
    const preset = Object.values(presets).flat().find((item) => item.value === value);
    if (!preset) return;
    mode = Object.keys(presets).find((key) => presets[key].some((item) => item.value === value)) || mode;
    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle("is-selected", selected); button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    $("gammaEnergyControl").hidden = mode !== "gamma";
    zInput.value = preset.z; nInput.value = preset.n; elementSelect.value = String(preset.z);
    if (preset.energy) $("gammaEnergy").value = preset.energy;
    if (preset.halfLife) {
      $("halfLifeValue").value = preset.halfLife;
      $("halfLifeUnit").value = preset.halfLifeUnit;
      updateHalfLifeReadouts();
    }
    clearEvent(); updateDecayReadouts();
  }

  function clampInputs(source) {
    if (source === "z") {
      const z = Math.max(1, Math.min(118, Math.round(Number(zInput.value) || 1)));
      zInput.value = z; elementSelect.value = String(z);
    } else if (source === "n") {
      nInput.value = Math.max(0, Math.min(220, Math.round(Number(nInput.value) || 0)));
    } else {
      zInput.value = Math.max(1, Math.min(118, Number(elementSelect.value) || 1));
    }
    presetSelect.value = "custom";
    clearEvent(); updateDecayReadouts();
  }

  function bindingEnergy(a, z) {
    const n = a - z;
    if (a <= 1 || z < 0 || n < 0) return 0;
    const volume = 15.75 * a;
    const surface = 17.8 * Math.pow(a, 2 / 3);
    const coulomb = 0.711 * z * Math.max(0, z - 1) / Math.pow(a, 1 / 3);
    const asymmetry = 23.7 * Math.pow(a - 2 * z, 2) / a;
    const pairing = a % 2 ? 0 : (z % 2 === 0 ? 1 : -1) * 34 / Math.pow(a, 0.75);
    return volume - surface - coulomb - asymmetry + pairing;
  }

  function estimateQ(m = mode) {
    if (m === "gamma") return Number($("gammaEnergy").value) / 1000;
    const p = parent(), d = daughter(m);
    if (d.z < 1 || d.n < 0) return null;
    const preset = (presets[m] || []).find((item) => item.value === presetSelect.value && item.z === p.z && item.n === p.n);
    if (preset && Number.isFinite(preset.q)) return preset.q;
    const deltaB = bindingEnergy(d.a, d.z) - bindingEnergy(p.a, p.z);
    if (m === "alpha") return 28.296 + deltaB;
    if (m === "betaMinus") return 0.7823 + deltaB;
    return -1.8044 + deltaB;
  }

  function daughterValid(m = mode) {
    const d = daughter(m);
    return d.z >= 1 && d.z <= 118 && d.n >= 0;
  }

  function updateDecayReadouts() {
    const p = parent(), d = daughter(), sym = elementSymbol(p.z), daughterSym = d.z >= 1 && d.z <= 118 ? elementSymbol(d.z) : "—";
    $("massNumber").textContent = String(p.a);
    const isTc99mPreset = mode === "gamma" && presetSelect.value === "tc99m" && p.z === 43 && p.n === 56;
    $("parentNotation").innerHTML = mode === "gamma" ? `<sup>${p.a}${isTc99mPreset ? "m" : "*"}</sup><sub>${p.z}</sub>${sym}` : `<sup>${p.a}</sup><sub>${p.z}</sub>${sym}`;
    $("daughterNotation").innerHTML = !daughterValid() ? "Not possible" : mode === "gamma" ? `<sup>${d.a}</sup><sub>${d.z}</sub>${daughterSym}` : `<sup>${d.a}</sup><sub>${d.z}</sub>${daughterSym}`;
    $("daughterStateLabel").textContent = mode === "gamma" ? "FINAL STATE" : "DAUGHTER";
    $("parentCounts").textContent = `${p.z} p · ${p.n} n`;
    $("daughterCounts").textContent = daughterValid() ? `${d.z} p · ${d.n} n` : "Outside this model";
    $("changeCounts").textContent = `${numberText(modes[mode].dz)}, ${numberText(modes[mode].dn)}`;
    $("massCheck").textContent = mode === "alpha" ? `${p.a} → ${d.a} + 4` : `${p.a} → ${d.a}`;
    const products = { alpha: "⁴₂He nucleus", betaMinus: "e⁻ + ν̄ₑ", betaPlus: "e⁺ + νₑ", gamma: `${Number($("gammaEnergy").value).toFixed(1)} keV photon` };
    $("emittedProducts").textContent = products[mode];
    $("gammaEnergyValue").textContent = `${Number($("gammaEnergy").value).toFixed(1)} keV`;
    const q = estimateQ(), status = $("energyStatus"), explanation = $("energyExplanation");
    const knownPreset = (presets[mode] || []).find((item) => item.value === presetSelect.value && item.z === p.z && item.n === p.n && Number.isFinite(item.q));
    const knownGamma = mode === "gamma" && presetSelect.value === "tc99m" && Math.abs(Number($("gammaEnergy").value) - 140.5) < 0.01;
    if (q === null) {
      $("qValue").textContent = "— MeV"; status.className = "energy-status is-invalid"; status.innerHTML = '<span class="energy-status-dot"></span><strong>NOT ENOUGH NUCLEONS</strong>';
      $("qValueLabel").textContent = "Q value";
      explanation.textContent = mode === "alpha" ? "Alpha emission needs at least two protons and two neutrons in the parent." : "The selected daughter would have an invalid proton or neutron count.";
    } else {
      $("qValue").textContent = `${q >= 0 ? "+" : ""}${q.toFixed(3)} MeV`;
      $("qValueLabel").textContent = mode === "gamma" ? "Chosen photon energy" : knownPreset ? "Evaluated Q value" : "SEMF estimate Q";
      const possible = mode === "gamma" || q > 0;
      status.className = `energy-status ${possible ? "is-possible" : "is-forbidden"}`;
      status.innerHTML = `<span class="energy-status-dot"></span><strong>${mode === "gamma" ? "USER-SET TRANSITION" : knownPreset ? "EVALUATED Q > 0" : possible ? "Q > 0 · ENERGETICALLY ALLOWED IN MODEL" : "Q < 0 · NOT ALLOWED IN MODEL"}</strong>`;
      explanation.textContent = mode === "gamma"
        ? "The photon carries the chosen excitation energy; Z, N, and A stay the same. Internal conversion is not shown."
        : knownPreset ? "This worked example uses an evaluated transition Q value. Positive Q permits the transition, but does not give the half-life or branching ratio."
          : possible ? "This approximate model leaves energy available. A positive Q is necessary, but does not give the half-life or branching ratio."
          : "This approximate model gives a negative Q, so this ground-state transition would need energy input.";
    }
    $("qFormulaNote").innerHTML = knownPreset
      ? `${knownPreset.qNote || `Evaluated Q value for this worked example: ${knownPreset.q.toFixed(5)} MeV.`} Other isotope and excited-state transitions may have different Q values. <a href="${knownPreset.source.replaceAll("&", "&amp;")}" target="_blank" rel="noreferrer">View NNDC ENSDF record</a>.`
      : knownGamma
      ? `The Tc-99m preset uses the evaluated 140.511 keV gamma line. <a href="https://www.nndc.bnl.gov/nudat3/getdecaydataset.jsp?dsid=99tc+it+decay+%286.0072+h%29&amp;nucleus=99TC" target="_blank" rel="noreferrer">View NNDC ENSDF record</a>. Moving the slider chooses an illustrative transition energy.`
      : mode === "gamma"
      ? "This is the slider's chosen level difference, not a lookup of measured gamma lines. Ground-state alpha and beta estimates use a liquid-drop binding-energy formula; shell structure and measured isotope masses can change the result."
      : mode === "betaPlus"
        ? "The estimate uses a liquid-drop binding-energy formula and includes the 2-electron-mass threshold for positron emission. Electron capture can still be energetically possible when β+ is not. Shell structure, measured isotope masses, daughter excitation, and transition selection rules are not included."
        : "The estimate uses a liquid-drop binding-energy formula and standard nucleon/electron mass differences. It is most limited for light nuclei and close to thresholds; it does not include measured atomic masses, daughter excitation, or transition selection rules.";
    const caption = mode === "alpha" ? "A compact ⁴He nucleus carries away 2 protons and 2 neutrons." : mode === "betaMinus" ? "A neutron becomes a proton; an electron and electron antineutrino leave." : mode === "betaPlus" ? "A proton becomes a neutron; a positron and electron neutrino leave." : "The excited nucleus loses energy as a photon; Z, N, and A stay the same.";
    $("decayCanvasTag").textContent = `${p.a}${mode === "gamma" ? (isTc99mPreset ? "m" : "*") : ""}${sym.toUpperCase()} · ${mode.toUpperCase()}`;
    updateEnergyPartition(q);
    if (!eventRunning && !eventComplete) $("decayEventCaption").textContent = caption;
    renderNuclideMap(); drawDecayCanvas(); drawDecayCloud();
  }

  function updateEnergyPartition(q = estimateQ()) {
    const isBeta = mode === "betaMinus" || mode === "betaPlus";
    $("betaEnergyControl").hidden = !isBeta;
    const share = Number($("betaShare").value) / 100;
    $("betaShareValue").textContent = `${Math.round(share * 100)}%`;
    if (q === null || q <= 0) {
      $("energyPartitionResult").textContent = q === null ? "No valid daughter nucleus for this transition." : "No outgoing kinetic-energy budget: the selected ground-state transition has Q ≤ 0 in this model.";
      $("energyPartitionNote").textContent = "This is an energy-accounting aid, not a decay-rate prediction.";
    } else if (mode === "alpha") {
      const p = parent(), d = daughter();
      const alphaK = q * d.a / p.a, recoil = q * 4 / p.a;
      $("energyPartitionResult").textContent = `Alpha kinetic energy ≈ ${(alphaK * 1000).toFixed(1)} keV · daughter recoil ≈ ${(recoil * 1000).toFixed(1)} keV.`;
      $("energyPartitionNote").textContent = "Two-body recoil split estimated from daughter and alpha mass numbers; electron shake-off is omitted.";
    } else if (isBeta) {
      const betaK = q * share, neutrino = q - betaK, particle = mode === "betaMinus" ? "electron" : "positron", nu = mode === "betaMinus" ? "antineutrino" : "neutrino";
      $("energyPartitionResult").textContent = `${particle}: ${(betaK * 1000).toFixed(1)} keV · ${nu}: ${(neutrino * 1000).toFixed(1)} keV.`;
      $("energyPartitionNote").textContent = "Move the slider to explore possible energy shares. Real beta spectra are continuous and not uniformly probable; recoil is omitted.";
    } else {
      const recoilKeV = (q * q / (2 * Math.max(1, parent().a) * 931.5)) * 1000;
      $("energyPartitionResult").textContent = `Photon: ${(q * 1000).toFixed(1)} keV · nucleus recoil ≈ ${recoilKeV.toFixed(4)} keV.`;
      $("energyPartitionNote").textContent = "The photon energy is set by the chosen level gap; recoil is calculated for a stationary parent.";
    }
  }

  function mapCoordinates(n, z, minN, minZ, cw, ch, left, top, maxZ) {
    return { x: left + (n - minN + 0.5) * cw, y: top + (maxZ - z + 0.5) * ch };
  }

  function renderNuclideMap() {
    const host = $("nuclideMap");
    const p = parent(), left = 76, right = 26, top = 24, bottom = 55, width = 880, height = 416, cols = 9, rows = 9;
    const previous = lastMapComposition;
    const changed = Boolean(previous && (previous.z !== p.z || previous.n !== p.n));
    const formatNucleus = (nucleus) => `<sup>${nucleus.a}</sup>${elementSymbol(nucleus.z)}`;
    const feedback = $("mapSelectionFeedback");
    if (previous && changed) {
      const dZ = p.z - previous.z, dN = p.n - previous.n;
      $("mapSelectionText").innerHTML = `Selection changed · ${formatNucleus(previous)} (Z ${previous.z} · N ${previous.n}) <span aria-hidden="true">→</span> <strong>${formatNucleus(p)} · Z ${p.z} · N ${p.n}</strong> · ΔZ ${numberText(dZ)} · ΔN ${numberText(dN)}`;
      feedback.classList.remove("is-changing");
      void feedback.offsetWidth;
      feedback.classList.add("is-changing");
    } else if (!previous) {
      $("mapSelectionText").innerHTML = `Selected <strong>${formatNucleus(p)} · Z ${p.z} · N ${p.n}</strong>`;
    } else {
      $("mapSelectionText").innerHTML = `Selected <strong>${formatNucleus(p)} · Z ${p.z} · N ${p.n}</strong>`;
    }
    lastMapComposition = { z: p.z, n: p.n, a: p.a };
    const minN = Math.max(0, p.n - 4), maxN = minN + cols - 1;
    const minZ = Math.min(110, Math.max(1, p.z - 4)), maxZ = minZ + rows - 1;
    const cw = (width - left - right) / cols, ch = (height - top - bottom) / rows;
    const grid = getComputedStyle(document.documentElement).getPropertyValue("--line").trim() || "#dcd9cc";
    const parentPoint = mapCoordinates(p.n, p.z, minN, minZ, cw, ch, left, top, maxZ);
    let svg = `<svg class="${changed ? "map-arrive" : ""}" viewBox="0 0 ${width} ${height}" role="group" aria-label="Nuclide chart centered near ${elementName(p.z)}-${p.a}; click a grid cell to choose proton and neutron counts"><defs><marker id="arrow-alpha" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#dfa820"/></marker><marker id="arrow-betaMinus" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#7baee3"/></marker><marker id="arrow-betaPlus" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#d184ad"/></marker></defs>`;
    for (let z = minZ; z <= maxZ; z++) for (let n = minN; n <= maxN; n++) {
      const pos = mapCoordinates(n, z, minN, minZ, cw, ch, left, top, maxZ);
      const isParent = n === p.n && z === p.z;
      svg += `<g class="map-cell ${isParent ? "map-cell-parent" : ""}" role="button" tabindex="0" aria-label="Select ${elementName(z)} with ${z} protons and ${n} neutrons, mass number ${n + z}" data-z="${z}" data-n="${n}"><rect x="${pos.x - cw / 2 + 1}" y="${pos.y - ch / 2 + 1}" width="${cw - 2}" height="${ch - 2}" rx="4" fill="${isParent ? "rgba(223,168,32,.19)" : "transparent"}" stroke="${isParent ? "#dfa820" : grid}"/><text x="${pos.x}" y="${pos.y - 3}" text-anchor="middle" class="map-cell-n">N ${n}</text><text x="${pos.x}" y="${pos.y + 11}" text-anchor="middle" class="map-cell-z">Z ${z}</text></g>`;
    }
    const routes = ["alpha", "betaMinus", "betaPlus"];
    for (const key of routes) {
      const d = daughter(key);
      if (d.n < minN || d.n > maxN || d.z < minZ || d.z > maxZ || d.z < 1 || d.n < 0 || d.z > 118) continue;
      const pos = mapCoordinates(d.n, d.z, minN, minZ, cw, ch, left, top, maxZ);
      const spec = modes[key], active = mode === key;
      svg += `<line x1="${parentPoint.x}" y1="${parentPoint.y}" x2="${pos.x}" y2="${pos.y}" stroke="${spec.color}" stroke-width="${active ? 3 : 1.7}" stroke-opacity="${active ? 1 : .56}" marker-end="url(#arrow-${key})"/><circle cx="${pos.x}" cy="${pos.y}" r="${active ? 9 : 7}" fill="${spec.color}" fill-opacity="${active ? .95 : .72}" stroke="#fff" stroke-width="1.5"/><text x="${pos.x + 8}" y="${pos.y - 10}" class="map-mode-label" fill="${spec.color}">${spec.label}</text>`;
    }
    svg += `<g class="map-parent-focus ${changed ? "map-parent-arrive" : ""}"><circle cx="${parentPoint.x}" cy="${parentPoint.y}" r="14" fill="none" stroke="#dfa820" stroke-width="${mode === "gamma" ? 3 : 2}"/><circle cx="${parentPoint.x}" cy="${parentPoint.y}" r="5" fill="#fff8dc" stroke="#dfa820" stroke-width="2"/>`;
    if (mode === "gamma") svg += `<circle cx="${parentPoint.x}" cy="${parentPoint.y}" r="20" fill="none" stroke="#79ad83" stroke-width="3" stroke-dasharray="4 3"/><text x="${parentPoint.x + 24}" y="${parentPoint.y - 16}" class="map-mode-label" fill="#79ad83">γ · same N,Z</text>`;
    svg += `</g>`;
    svg += `<text x="${left + (width - left - right) / 2}" y="${height - 13}" text-anchor="middle" class="map-axis-label">NEUTRONS · N →</text><text x="18" y="${top + (height - top - bottom) / 2}" transform="rotate(-90 18 ${top + (height - top - bottom) / 2})" text-anchor="middle" class="map-axis-label">PROTONS · Z →</text></svg>`;
    host.innerHTML = svg;
    host.querySelectorAll(".map-cell").forEach((cell) => {
      const select = () => { zInput.value = cell.dataset.z; nInput.value = cell.dataset.n; elementSelect.value = cell.dataset.z; presetSelect.value = "custom"; clearEvent(); updateDecayReadouts(); };
      cell.addEventListener("click", select);
      cell.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
    });
    $("modeRules").innerHTML = `<span style="--mode-color:#dfa820">α <b>ΔZ −2 · ΔN −2 · A −4</b></span><span style="--mode-color:#7baee3">β⁻ <b>ΔZ +1 · ΔN −1 · A same</b></span><span style="--mode-color:#d184ad">β⁺ <b>ΔZ −1 · ΔN +1 · A same</b></span><span style="--mode-color:#79ad83">γ <b>Z, N, A same · lower energy level</b></span>`;
  }

  function clearEvent() {
    eventRunning = false; eventComplete = false; eventProgress = 0; eventCount = 0;
    if (loopTimeout) clearTimeout(loopTimeout);
    loopTimeout = null;
    $("decayRunState").textContent = "READY";
    $("decayPlay").querySelector("span").textContent = "Animate decay";
    $("decayPlay").firstChild.textContent = "▶ ";
  }

  function finishEvent() {
    eventRunning = false; eventComplete = true; eventProgress = 1; eventCount++;
    $("decayRunState").textContent = "EVENT SHOWN";
    $("decayPlay").querySelector("span").textContent = "Replay decay";
    $("decayPlay").firstChild.textContent = "▶ ";
    const q = estimateQ();
    const caveat = mode !== "gamma" && q !== null && q <= 0 ? " (shown as a conservation diagram; the model Q is negative)" : "";
    $("decayEventCaption").textContent = `${modes[mode].label} event complete${caveat}. The parent-to-daughter bookkeeping is shown in the ledger.`;
    if ($("decayAuto").checked) loopTimeout = setTimeout(() => { eventProgress = 0; eventComplete = false; eventRunning = true; eventLast = performance.now(); $("decayRunState").textContent = "ANIMATING"; }, 800);
  }

  function startEvent() {
    if (!daughterValid()) {
      $("decayEventCaption").textContent = mode === "alpha" ? "This parent needs at least two protons and two neutrons to emit an alpha particle." : "The selected daughter would have an invalid proton or neutron count.";
      return;
    }
    if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
    if (eventComplete || eventProgress >= 1) eventProgress = 0;
    eventRunning = !eventRunning;
    eventLast = performance.now();
    $("decayRunState").textContent = eventRunning ? "ANIMATING" : "PAUSED";
    $("decayPlay").querySelector("span").textContent = eventRunning ? "Pause animation" : "Continue animation";
    $("decayPlay").firstChild.textContent = eventRunning ? "Ⅱ " : "▶ ";
    if (eventRunning) $("decayEventCaption").textContent = `Showing ${modes[mode].name} composition and emitted particles…`;
  }

  function stepEvent() {
    if (!daughterValid()) {
      $("decayEventCaption").textContent = mode === "alpha" ? "This parent needs at least two protons and two neutrons to emit an alpha particle." : "The selected daughter would have an invalid proton or neutron count.";
      return;
    }
    if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
    eventRunning = false;
    eventProgress = eventComplete ? 0 : eventProgress;
    eventComplete = false;
    eventProgress = Math.min(1, eventProgress + 0.25);
    $("decayRunState").textContent = eventProgress >= 1 ? "EVENT SHOWN" : `STEP ${Math.round(eventProgress * 4)}/4`;
    $("decayEventCaption").textContent = `Step ${Math.round(eventProgress * 4)} of 4: follow the nucleus and emitted particle(s).`;
    if (eventProgress >= 1) { eventComplete = true; eventCount++; }
    $("decayPlay").querySelector("span").textContent = eventComplete ? "Replay decay" : "Animate decay";
    $("decayPlay").firstChild.textContent = "▶ ";
  }

  function drawNucleons(x, y, z, n, alpha = 1, scale = 1) {
    const total = Math.max(1, z + n), count = Math.min(74, total), protonDots = Math.round(count * z / total);
    const radius = (18 + Math.min(38, Math.sqrt(total) * 2.3)) * scale;
    decayCtx.save(); decayCtx.globalAlpha = alpha;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const r = radius * Math.sqrt((i + .45) / count), a = i * golden;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      decayCtx.beginPath(); decayCtx.arc(px, py, Math.max(2.1, 4.1 - count / 35), 0, Math.PI * 2);
      decayCtx.fillStyle = i < protonDots ? "#f0b746" : "#86bda0"; decayCtx.fill();
      decayCtx.strokeStyle = "rgba(4,12,10,.7)"; decayCtx.lineWidth = 1; decayCtx.stroke();
    }
    decayCtx.restore();
    return radius;
  }

  function drawDecayCanvas(now = performance.now()) {
    const rect = decayCanvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    const dim = `${Math.round(rect.width * dpr)}x${Math.round(rect.height * dpr)}`;
    if (dim !== lastDecaySize) { lastDecaySize = dim; decayCanvas.width = Math.round(rect.width * dpr); decayCanvas.height = Math.round(rect.height * dpr); decayCtx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    const w = rect.width, h = rect.height, p = parent(), d = daughter(), progress = eventProgress;
    const bg = decayCtx.createLinearGradient(0, 0, w, h); bg.addColorStop(0, "#0c1714"); bg.addColorStop(1, "#17231e");
    decayCtx.fillStyle = bg; decayCtx.fillRect(0, 0, w, h);
    decayCtx.strokeStyle = "rgba(157,190,167,.09)"; decayCtx.lineWidth = 1;
    for (let x = 25; x < w; x += 42) { decayCtx.beginPath(); decayCtx.moveTo(x, 0); decayCtx.lineTo(x, h); decayCtx.stroke(); }
    for (let y = 24; y < h; y += 42) { decayCtx.beginPath(); decayCtx.moveTo(0, y); decayCtx.lineTo(w, y); decayCtx.stroke(); }
    const cx = w * .40, cy = h * .51, daughterIsShown = eventComplete || progress > .44;
    const current = daughterIsShown && daughterValid() ? d : p;
    decayCtx.save(); decayCtx.setLineDash([4, 6]); decayCtx.strokeStyle = "rgba(207,224,211,.24)"; decayCtx.beginPath(); decayCtx.moveTo(cx, 20); decayCtx.lineTo(cx, h - 34); decayCtx.stroke(); decayCtx.restore();
    const radius = drawNucleons(cx, cy, current.z, current.n, 1, 1);
    decayCtx.textAlign = "center"; decayCtx.font = "600 11px var(--mono)"; decayCtx.fillStyle = "#f0e8cf";
    const isTc99mPreset = mode === "gamma" && presetSelect.value === "tc99m" && p.z === 43 && p.n === 56;
    decayCtx.fillText(`${current.a}${mode === "gamma" && !daughterIsShown ? (isTc99mPreset ? "m" : "*") : ""}${elementSymbol(current.z)} · ${current.z}p ${current.n}n`, cx, cy + radius + 23);
    decayCtx.font = "9px var(--mono)"; decayCtx.fillStyle = "rgba(219,229,215,.55)"; decayCtx.fillText(daughterIsShown ? "DAUGHTER / LOWER LEVEL" : "PARENT NUCLEUS", cx, 20);
    const travel = Math.min(1, Math.max(0, progress));
    if (travel > 0 && mode === "alpha") {
      const px = cx + radius + 18 + travel * Math.max(35, w * .37), py = cy + Math.sin(travel * 2.3) * 16;
      decayCtx.strokeStyle = "rgba(240,183,70,.5)"; decayCtx.lineWidth = 2; decayCtx.beginPath(); decayCtx.moveTo(cx + radius, cy); decayCtx.lineTo(px - 6, py); decayCtx.stroke();
      decayCtx.fillStyle = "#f4ca6c";
      [[-5,-5],[5,-5],[-5,5],[5,5]].forEach(([dx,dy], i) => { decayCtx.beginPath(); decayCtx.arc(px + dx, py + dy, 4.1, 0, Math.PI*2); decayCtx.fillStyle = i % 2 ? "#8fbea0" : "#f0b746"; decayCtx.fill(); });
      decayCtx.fillStyle = "#f6ebcf"; decayCtx.font = "10px var(--mono)"; decayCtx.fillText("⁴He · 2p + 2n", Math.min(w - 76, px), py + 28);
    } else if (travel > 0 && (mode === "betaMinus" || mode === "betaPlus")) {
      const sign = mode === "betaMinus" ? "e⁻" : "e⁺", nu = mode === "betaMinus" ? "ν̄ₑ" : "νₑ";
      const px = cx + radius + 18 + travel * Math.max(35, w * .35), py = cy - travel * 48;
      const nx = cx + radius + 12 + travel * Math.max(30, w * .23), ny = cy + travel * 58;
      decayCtx.strokeStyle = mode === "betaMinus" ? "rgba(123,174,227,.65)" : "rgba(209,132,173,.65)";
      decayCtx.lineWidth = 2; decayCtx.beginPath(); decayCtx.moveTo(cx + radius, cy); decayCtx.lineTo(px, py); decayCtx.moveTo(cx + radius, cy); decayCtx.lineTo(nx, ny); decayCtx.stroke();
      decayCtx.beginPath(); decayCtx.arc(px, py, 6, 0, Math.PI * 2); decayCtx.fillStyle = mode === "betaMinus" ? "#7baee3" : "#d184ad"; decayCtx.fill();
      decayCtx.fillStyle = "#f6ebcf"; decayCtx.font = "10px var(--mono)"; decayCtx.textAlign = "left"; decayCtx.fillText(sign, px + 10, py + 3); decayCtx.fillText(nu, nx + 9, ny + 3);
      decayCtx.beginPath(); decayCtx.arc(nx, ny, 3, 0, Math.PI * 2); decayCtx.fillStyle = "#d9e5cc"; decayCtx.fill();
    } else if (travel > 0 && mode === "gamma") {
      const endX = cx + radius + 22 + travel * Math.max(45, w * .42), startX = cx + radius + 14;
      decayCtx.strokeStyle = "#79ad83"; decayCtx.lineWidth = 2.2; decayCtx.beginPath();
      for (let x = startX; x <= endX; x += 2) { const y = cy + Math.sin((x - startX) / 13) * 8; if (x === startX) decayCtx.moveTo(x, y); else decayCtx.lineTo(x, y); }
      decayCtx.stroke(); decayCtx.fillStyle = "#b9dbb9"; decayCtx.font = "10px var(--mono)"; decayCtx.textAlign = "left"; decayCtx.fillText(`${Number($("gammaEnergy").value).toFixed(1)} keV γ`, Math.min(w - 115, endX + 8), cy - 13);
    }
    decayCtx.textAlign = "left"; decayCtx.fillStyle = "rgba(219,229,215,.58)"; decayCtx.font = "9px var(--mono)"; decayCtx.fillText("SCHEMATIC NUCLEONS · NOT TO SCALE", 12, h - 12);
  }

  function formatNumber(value) {
    if (value >= 1000000) return value.toExponential(2);
    return Math.round(value).toLocaleString();
  }

  function survivorsAt(halfLives) {
    let low = 0, high = decayTimes.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (decayTimes[middle] <= halfLives) low = middle + 1; else high = middle;
    }
    return decayTimes.length - low;
  }

  function rerollSample() {
    const n0 = Number($("sampleSlider").value);
    decayTimes = Array.from({ length: n0 }, () => -Math.log(1 - Math.random()) / Math.LN2).sort((a, b) => a - b);
    const shown = Math.min(n0, 150), chosen = new Set();
    cloudParticles = [];
    while (cloudParticles.length < shown) {
      const index = Math.floor(Math.random() * n0);
      if (chosen.has(index)) continue;
      chosen.add(index);
      const spotAngle = Math.random() * Math.PI * 2, spotRadius = Math.sqrt(Math.random()) * .86;
      cloudParticles.push({
        decayTime: decayTimes[index], spotAngle, spotRadius,
        emissionAngle: Math.random() * Math.PI * 2,
        neutrinoAngle: Math.random() * Math.PI * 2
      });
    }
    $("cloudCountLabel").textContent = `${shown} of ${formatNumber(n0)} nuclei shown`;
    randomRemaining = survivorsAt(Number($("elapsedSlider").value));
    updateHalfLifeReadouts();
  }

  function updateHalfLifeReadouts() {
    const n0 = Number($("sampleSlider").value), halfLives = Number($("elapsedSlider").value), pSurvive = Math.pow(2, -halfLives);
    const expected = n0 * pSurvive, value = Math.max(0.000001, Number($("halfLifeValue").value) || 1), unit = $("halfLifeUnit").value;
    const time = value * halfLives, unitLabels = { s: "seconds", min: "minutes", h: "hours", d: "days", y: "years" };
    $("elapsedValue").textContent = `${halfLives.toFixed(1)} T½`;
    $("elapsedClock").textContent = `${halfLives.toFixed(1)} half-lives`;
    $("sampleValue").textContent = formatNumber(n0);
    $("expectedRemaining").textContent = formatNumber(expected);
    $("sampleRemaining").textContent = formatNumber(randomRemaining);
    $("remainingFraction").textContent = `${(pSurvive * 100).toFixed(2)}%`;
    $("elapsedReal").textContent = `${Number(time.toPrecision(3)).toLocaleString()} ${unitLabels[unit]}`;
    drawHalfLifeChart(expected, randomRemaining, n0, halfLives);
    drawDecayCloud();
  }

  function drawDecayCloud() {
    const rect = decayCloudCanvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    const dim = `${Math.round(rect.width * dpr)}x${Math.round(rect.height * dpr)}`;
    if (dim !== lastCloudSize) {
      lastCloudSize = dim;
      decayCloudCanvas.width = Math.round(rect.width * dpr);
      decayCloudCanvas.height = Math.round(rect.height * dpr);
      decayCloudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const w = rect.width, h = rect.height, elapsed = Number($("elapsedSlider").value);
    const cx = w / 2, cy = h / 2, chamberRadius = Math.max(18, Math.min(w / 2 - 7, h / 2 - 7));
    const colors = { alpha: "#f0b746", betaMinus: "#7baee3", betaPlus: "#d184ad", gamma: "#79ad83" };
    const color = colors[mode], modeName = { alpha: "α particles", betaMinus: "electrons + antineutrinos", betaPlus: "positrons + neutrinos", gamma: "γ photons" }[mode];
    const n0 = Number($("sampleSlider").value), decayed = n0 - randomRemaining;
    const bg = decayCloudCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#13221b"); bg.addColorStop(1, "#0b1512");
    decayCloudCtx.clearRect(0, 0, w, h); decayCloudCtx.fillStyle = bg; decayCloudCtx.fillRect(0, 0, w, h);
    decayCloudCtx.save();
    decayCloudCtx.beginPath(); decayCloudCtx.arc(cx, cy, chamberRadius, 0, Math.PI * 2); decayCloudCtx.clip();
    decayCloudCtx.strokeStyle = "rgba(182,211,187,.10)"; decayCloudCtx.lineWidth = 1;
    for (let ring = chamberRadius * .33; ring < chamberRadius; ring += chamberRadius * .33) {
      decayCloudCtx.beginPath(); decayCloudCtx.arc(cx, cy, ring, 0, Math.PI * 2); decayCloudCtx.stroke();
    }
    decayCloudCtx.beginPath(); decayCloudCtx.moveTo(cx - chamberRadius, cy); decayCloudCtx.lineTo(cx + chamberRadius, cy); decayCloudCtx.moveTo(cx, cy - chamberRadius); decayCloudCtx.lineTo(cx, cy + chamberRadius); decayCloudCtx.stroke();
    let visibleParents = 0, visibleDaughters = 0;
    for (const particle of cloudParticles) {
      const x = cx + Math.cos(particle.spotAngle) * particle.spotRadius * chamberRadius;
      const y = cy + Math.sin(particle.spotAngle) * particle.spotRadius * chamberRadius;
      const age = elapsed - particle.decayTime;
      if (age < 0) {
        visibleParents++;
        decayCloudCtx.beginPath(); decayCloudCtx.arc(x, y, 2.1, 0, Math.PI * 2); decayCloudCtx.fillStyle = "#f2c75e"; decayCloudCtx.fill();
        continue;
      }
      visibleDaughters++;
      const rayLength = Math.min(chamberRadius * .38, 5 + age * chamberRadius * .18);
      const ex = x + Math.cos(particle.emissionAngle) * rayLength, ey = y + Math.sin(particle.emissionAngle) * rayLength;
      decayCloudCtx.save(); decayCloudCtx.globalAlpha = Math.max(.18, 1 - age / 4.2);
      decayCloudCtx.strokeStyle = color; decayCloudCtx.lineWidth = 1.35;
      decayCloudCtx.beginPath();
      if (mode === "gamma") {
        const px = -Math.sin(particle.emissionAngle), py = Math.cos(particle.emissionAngle);
        const steps = 18;
        for (let step = 0; step <= steps; step++) {
          const t = step / steps, wave = Math.sin(t * Math.PI * 7) * 1.5;
          const tx = x + Math.cos(particle.emissionAngle) * rayLength * t + px * wave;
          const ty = y + Math.sin(particle.emissionAngle) * rayLength * t + py * wave;
          if (step === 0) decayCloudCtx.moveTo(tx, ty); else decayCloudCtx.lineTo(tx, ty);
        }
      } else {
        decayCloudCtx.moveTo(x, y); decayCloudCtx.lineTo(ex, ey);
      }
      decayCloudCtx.stroke();
      if (mode === "betaMinus" || mode === "betaPlus") {
        const nx = x + Math.cos(particle.neutrinoAngle) * rayLength * .72, ny = y + Math.sin(particle.neutrinoAngle) * rayLength * .72;
        decayCloudCtx.setLineDash([2, 3]); decayCloudCtx.strokeStyle = "rgba(225,235,220,.66)"; decayCloudCtx.lineWidth = .85;
        decayCloudCtx.beginPath(); decayCloudCtx.moveTo(x, y); decayCloudCtx.lineTo(nx, ny); decayCloudCtx.stroke(); decayCloudCtx.setLineDash([]);
      }
      decayCloudCtx.beginPath(); decayCloudCtx.arc(ex, ey, 1.65, 0, Math.PI * 2); decayCloudCtx.fillStyle = color; decayCloudCtx.fill();
      decayCloudCtx.restore();
      decayCloudCtx.beginPath(); decayCloudCtx.arc(x, y, 1.8, 0, Math.PI * 2); decayCloudCtx.fillStyle = "#8fbea0"; decayCloudCtx.fill();
    }
    decayCloudCtx.restore();
    decayCloudCtx.beginPath(); decayCloudCtx.arc(cx, cy, chamberRadius, 0, Math.PI * 2); decayCloudCtx.strokeStyle = "rgba(204,225,205,.55)"; decayCloudCtx.lineWidth = 1.1; decayCloudCtx.stroke();
    decayCloudCtx.fillStyle = "rgba(228,238,220,.72)"; decayCloudCtx.font = "7px ui-monospace, monospace"; decayCloudCtx.textAlign = "left";
    decayCloudCtx.fillText("PARENT", Math.max(5, cx - chamberRadius + 4), 10);
    decayCloudCtx.textAlign = "right"; decayCloudCtx.fillText("DAUGHTER", Math.min(w - 5, cx + chamberRadius - 4), 10);
    decayCloudCtx.textAlign = "left";
    $("cloudReadout").textContent = `Shown: ${visibleParents} parents · ${visibleDaughters} decayed · ${modeName}`;
  }

  function drawHalfLifeChart(expected, sampled, start, elapsed) {
    const rect = halfLifeCanvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    const dim = `${Math.round(rect.width * dpr)}x${Math.round(rect.height * dpr)}`;
    if (dim !== lastClockSize) { lastClockSize = dim; halfLifeCanvas.width = Math.round(rect.width * dpr); halfLifeCanvas.height = Math.round(rect.height * dpr); halfCtx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    const w = rect.width, h = rect.height, padL = 45, padR = 12, padT = 13, padB = 28;
    const style = getComputedStyle(document.documentElement), muted = style.getPropertyValue("--muted").trim(), line = style.getPropertyValue("--line").trim(), green = style.getPropertyValue("--green").trim(), gold = style.getPropertyValue("--gold").trim();
    halfCtx.clearRect(0, 0, w, h); halfCtx.font = "9px ui-monospace, monospace"; halfCtx.strokeStyle = line; halfCtx.fillStyle = muted; halfCtx.lineWidth = 1;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH * i / 4, val = start * (1 - i / 4);
      halfCtx.globalAlpha = .55; halfCtx.beginPath(); halfCtx.moveTo(padL, y); halfCtx.lineTo(w - padR, y); halfCtx.stroke(); halfCtx.globalAlpha = 1;
      halfCtx.fillStyle = muted; halfCtx.fillText(formatNumber(val), 2, y + 3);
    }
    for (let i = 0; i <= 6; i += 1) {
      const x = padL + plotW * i / 6; halfCtx.fillStyle = muted; halfCtx.fillText(String(i), x - 2, h - 8);
    }
    halfCtx.strokeStyle = green; halfCtx.lineWidth = 2.3; halfCtx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = 6 * i / 120, v = start * Math.pow(2, -t), x = padL + plotW * t / 6, y = padT + plotH * (1 - v / start);
      if (!i) halfCtx.moveTo(x, y); else halfCtx.lineTo(x, y);
    }
    halfCtx.stroke();
    const x = padL + plotW * elapsed / 6, y = padT + plotH * (1 - expected / start);
    halfCtx.fillStyle = gold; halfCtx.beginPath(); halfCtx.arc(x, y, 4, 0, Math.PI * 2); halfCtx.fill();
    const sy = padT + plotH * (1 - sampled / start); halfCtx.fillStyle = "#7baee3"; halfCtx.beginPath(); halfCtx.arc(x, sy, 3.2, 0, Math.PI * 2); halfCtx.fill();
    halfCtx.fillStyle = muted; halfCtx.textAlign = "center"; halfCtx.fillText("ELAPSED HALF-LIVES · t/T½", padL + plotW / 2, h - 1); halfCtx.textAlign = "left";
  }

  modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  elementSelect.addEventListener("change", () => clampInputs("element"));
  zInput.addEventListener("input", () => { if (zInput.value !== "") clampInputs("z"); });
  zInput.addEventListener("change", () => clampInputs("z"));
  nInput.addEventListener("input", () => { if (nInput.value !== "") clampInputs("n"); });
  nInput.addEventListener("change", () => clampInputs("n"));
  presetSelect.addEventListener("change", () => applyPreset(presetSelect.value));
  $("gammaEnergy").addEventListener("input", updateDecayReadouts);
  $("betaShare").addEventListener("input", () => updateEnergyPartition());
  $("decayPlay").addEventListener("click", startEvent);
  $("decayStep").addEventListener("click", stepEvent);
  $("decayReset").addEventListener("click", () => { clearEvent(); updateDecayReadouts(); });
  $("decayAuto").addEventListener("change", () => { if (!$("decayAuto").checked && loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; } });
  $("decaySpeed").addEventListener("input", () => {});
  $("elapsedSlider").addEventListener("input", () => { randomRemaining = survivorsAt(Number($("elapsedSlider").value)); updateHalfLifeReadouts(); });
  $("sampleSlider").addEventListener("input", rerollSample);
  $("halfLifeValue").addEventListener("input", updateHalfLifeReadouts);
  $("halfLifeUnit").addEventListener("change", updateHalfLifeReadouts);
  $("clockReroll").addEventListener("click", rerollSample);
  $("clockPlay").addEventListener("click", () => {
    clockPlaying = !clockPlaying;
    const button = $("clockPlay");
    button.setAttribute("aria-pressed", String(clockPlaying));
    button.setAttribute("aria-label", `${clockPlaying ? "Pause" : "Play"} half-life decay animation`);
    button.innerHTML = `${clockPlaying ? "Ⅱ" : "▶"} <span>${clockPlaying ? "Pause" : "Play"}</span>`;
  });

  window.addEventListener("resize", () => { lastDecaySize = ""; lastClockSize = ""; lastCloudSize = ""; renderNuclideMap(); drawHalfLifeChart(Number($("expectedRemaining").textContent.replaceAll(",", "")) || 0, randomRemaining, Number($("sampleSlider").value), Number($("elapsedSlider").value)); drawDecayCloud(); });
  populatePresets(false);
  setMode("alpha", false);
  rerollSample();
  drawDecayCanvas();

  function animateDecay(now) {
    const dt = Math.min(.05, Math.max(0, (now - eventLast) / 1000));
    eventLast = now;
    if (clockPlaying) {
      const next = Number($("elapsedSlider").value) + dt * .45;
      if (next >= 6) {
        $("elapsedSlider").value = "0";
        rerollSample();
      } else {
        $("elapsedSlider").value = next.toFixed(2);
        randomRemaining = survivorsAt(Number($("elapsedSlider").value));
        updateHalfLifeReadouts();
      }
    }
    if (eventRunning) {
      eventProgress = Math.min(1, eventProgress + dt * Number($("decaySpeed").value) / 1.8);
      if (eventProgress >= 1) finishEvent();
    }
    drawDecayCanvas(now);
    currentFrame = requestAnimationFrame(animateDecay);
  }
  eventLast = performance.now(); currentFrame = requestAnimationFrame(animateDecay);
})();
