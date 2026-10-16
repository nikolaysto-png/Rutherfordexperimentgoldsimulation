/* Pure decay kinematics. Energies: MeV; momenta: MeV/c; masses: MeV/c². */
(function (root) {
  "use strict";
  const U = 931.49410242, ELECTRON = 0.51099895, ALPHA = 3727.3794066;
  const scale = (v, s) => v.map(x => x * s);
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = v => Math.hypot(...v);
  const kinetic = (p, m) => p * p / (Math.hypot(p, m) + m);
  const direction = (rng = Math.random) => {
    const z = 2 * rng() - 1, phi = 2 * Math.PI * rng(), r = Math.sqrt(Math.max(0, 1 - z * z));
    return [r * Math.cos(phi), r * Math.sin(phi), z];
  };
  const lifetime = (rng = Math.random) => -Math.log1p(-Math.min(1 - Number.EPSILON, rng())) / Math.LN2;
  const endpoint = (q, mass) => q * (q + 2 * mass) / (2 * (mass + ELECTRON + q));

  // Allowed spectrum with a point-Coulomb Fermi approximation. Nuclear shape,
  // screening, radiative corrections and angular correlations are not included.
  function betaWeight(t, end, z, positron) {
    if (t < 0 || t >= end || end <= 0) return 0;
    const e = t + ELECTRON, p = Math.sqrt(t * (t + 2 * ELECTRON));
    const a = 2 * Math.PI * z / 137.035999084 * e;
    let pF;
    if (p < 1e-12) pF = positron ? 0 : a;
    else if (a < 1e-12) pF = p;
    else {
      const x = a / p;
      pF = positron ? (x > 700 ? 0 : a / Math.expm1(x)) : a / -Math.expm1(-x);
    }
    return pF * e * (end - t) ** 2;
  }
  const spectrumCache = new Map();
  function spectrum(q, mass, z, positron) {
    const key = `${q}:${mass}:${z}:${positron}`;
    if (spectrumCache.has(key)) return spectrumCache.get(key);
    const end = endpoint(q, mass), bins = 512, weights = [], cdf = [0];
    let total = 0;
    for (let i = 0; i <= bins; i++) {
      weights.push(betaWeight(end * i / bins, end, z, positron));
      if (i) { total += (weights[i - 1] + weights[i]) / 2; cdf.push(total); }
    }
    if (total > 0) for (let i = 0; i <= bins; i++) cdf[i] /= total;
    const result = { end, weights, cdf };
    if (spectrumCache.size > 24) spectrumCache.delete(spectrumCache.keys().next().value);
    spectrumCache.set(key, result);
    return result;
  }
  function sampleSpectrum(spec, rng = Math.random) {
    const u = rng(); let low = 1, high = spec.cdf.length - 1;
    while (low < high) { const mid = (low + high) >>> 1; if (spec.cdf[mid] < u) low = mid + 1; else high = mid; }
    const a = spec.cdf[low - 1], b = spec.cdf[low];
    return spec.end * (low - 1 + (b > a ? (u - a) / (b - a) : 0)) / (spec.cdf.length - 1);
  }
  function particle(kind, mass, energy, momentum) {
    return { kind, mass, energy, momentum, speed: mass ? norm(momentum) / (mass + energy) : 1 };
  }
  function event({ mode, q, a, z, share = null, rng = Math.random }) {
    if (!(q > 0) || !(a > 0)) return null;
    const mass = a * U, axis = direction(rng);
    let products, recoil;
    if (mode === "alpha") {
      const total = mass + ALPHA + q;
      const p = Math.sqrt(q * (q + 2 * ALPHA) * (q + 2 * mass) * (q + 2 * (mass + ALPHA))) / (2 * total);
      products = [particle("alpha", ALPHA, kinetic(p, ALPHA), scale(axis, p))];
      recoil = particle("daughter", mass, kinetic(p, mass), scale(axis, -p));
    } else if (mode === "gamma") {
      // q is the selected photon energy, not the nuclear level gap.
      products = [particle("gamma", 0, q, scale(axis, q))];
      recoil = particle("daughter", mass, kinetic(q, mass), scale(axis, -q));
      q += recoil.energy;
    } else {
      const spec = spectrum(q, mass, z, mode === "betaPlus");
      const t = share === null ? sampleSpectrum(spec, rng) : spec.end * Math.min(1, Math.max(0, share));
      const p = Math.sqrt(t * (t + 2 * ELECTRON)), nuAxis = direction(rng), cosine = dot(axis, nuAxis);
      // Solve energy conservation for a massless neutrino with an independently
      // sampled direction. The daughter absorbs the vector sum of both momenta.
      const remaining = q - t;
      const nuEnergy = Math.max(0, (2 * mass * remaining + remaining * remaining - p * p) / (2 * (mass + remaining + p * cosine)));
      const betaP = scale(axis, p), nuP = scale(nuAxis, nuEnergy), daughterP = scale(add(betaP, nuP), -1);
      products = [particle(mode, ELECTRON, t, betaP), particle("neutrino", 0, nuEnergy, nuP)];
      recoil = particle("daughter", mass, kinetic(norm(daughterP), mass), daughterP);
    }
    return { mode, q, products, recoil };
  }
  // Repulsive Coulomb orbit, specified by asymptotic speed v and impact b.
  function coulombIncoming(x, b, v, k) {
    if (Math.abs(b) < 1e-8) return { x, y: 0, vx: Math.sqrt(Math.max(0, v*v - 2*k/Math.abs(x))), vy: 0 };
    let y = b;
    for (let i = 0; i < 16; i++) {
      const r = Math.hypot(x, y);
      const f = b*v*v*(y-b) - k*y*y/(r-x);
      const slope = b*v*v - k*y/r;
      const delta = f/slope; y -= delta;
      if (Math.abs(delta) < 1e-10) break;
    }
    const r = Math.hypot(x, y);
    return { x, y, vx: v-k*y/(b*v*r), vy: k*y*y/(r*(r-x)*b*v) };
  }
  function coulombOutgoing(x, y, vx, vy, k) {
    const r = Math.hypot(x,y), h = x*vy-y*vx;
    const ax = vy*h+k*x/r, ay = -vx*h+k*y/r, length = Math.hypot(ax,ay);
    const cos = Math.min(1,k/length), sin = Math.sqrt(Math.max(0,1-cos*cos)), sign = Math.sign(h) || 1;
    return Math.atan2(cos*ay+sign*sin*ax, cos*ax-sign*sin*ay);
  }
  const api = Object.freeze({ U, ELECTRON, ALPHA, scale, add, dot, norm, kinetic, direction, lifetime, endpoint, betaWeight, spectrum, sampleSpectrum, event, coulombIncoming, coulombOutgoing });
  root.DecayPhysics = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
