// ---------- Radioactive decay teaching lab ----------
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const physics = window.DecayPhysics;
  const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
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
  let currentEvent = null, elapsed = Number($("elapsedSlider").value), dirty = true, lastReadoutTime = 0;
  const eventCamera = { yaw: -.35, pitch: .25 }, cloudCamera = { yaw: -.45, pitch: .3 };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches) $("cloudRotate").checked = false;
  const canEmit = () => daughterValid() && Number(estimateQ()) > 0;
  const unit = v => { const length = physics.norm(v); return length > 0 ? physics.scale(v, 1 / length) : [0, 0, 0]; };
  const eventOptions = () => ({ mode, q: estimateQ(), a: daughter().a, z: daughter().z,
    share: $("betaSampling").value === "manual" ? Number($("betaShare").value) / 100 : null });
  function seedRandom(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
  function prepareEvent() { currentEvent = canEmit() ? physics.event(eventOptions()) : null; updateEnergyPartition(); dirty = true; }
  function refreshCloudEvents() {
    for (const particle of cloudParticles) particle.event = canEmit() ? physics.event({ ...eventOptions(), share: null, rng: seedRandom(particle.seed) }) : null;
  }

  const elementSymbol = (z) => elementData[Math.max(0, Math.min(elementData.length - 1, z - 1))][0];
  const elementName = (z) => elementData[Math.max(0, Math.min(elementData.length - 1, z - 1))][1];
  const parent = () => {
    const z = Math.max(1, Math.min(118, Math.round(Number(zInput.value) || 1)));
    const n = Math.max(0, Math.min(220, Math.round(Number(nInput.value) || 0)));
    return { z, n, a: z + n };
  };
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
    if (keepComposition) populatePresets($("keepNucleus").checked);
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
    if (d.z < 1 || d.z > 118 || d.n < 0) return null;
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
        ? "The chosen photon energy also implies a small recoil energy. Their sum is the level-energy difference; Z, N, and A stay the same."
        : knownPreset ? "This worked example uses an evaluated transition Q value. Positive Q permits the transition, but does not give the half-life or branching ratio."
          : possible ? "This approximate model leaves energy available. A positive Q is necessary, but does not give the half-life or branching ratio."
          : "This approximate model gives a negative Q, so this ground-state transition would need energy input.";
    }
    $("qFormulaNote").innerHTML = knownPreset
      ? `${knownPreset.qNote || `Evaluated Q value for this worked example: ${knownPreset.q.toFixed(5)} MeV.`} Other isotope and excited-state transitions may have different Q values. <a href="${knownPreset.source.replaceAll("&", "&amp;")}" target="_blank" rel="noreferrer">View NNDC ENSDF record</a>.`
      : knownGamma
      ? `The Tc-99m preset uses the evaluated 140.511 keV gamma line. <a href="https://www.nndc.bnl.gov/nudat3/getdecaydataset.jsp?dsid=99tc+it+decay+%286.0072+h%29&amp;nucleus=99TC" target="_blank" rel="noreferrer">View NNDC ENSDF record</a>. Moving the slider chooses an illustrative transition energy.`
      : mode === "gamma"
      ? "This is the chosen photon energy; the level gap is slightly larger because the nucleus recoils. Ground-state alpha and beta estimates use a liquid-drop binding-energy formula; shell structure and measured isotope masses can change the result."
      : mode === "betaPlus"
        ? "The estimate uses a liquid-drop binding-energy formula and includes the 2-electron-mass threshold for positron emission. Electron capture can still be energetically possible when β+ is not. Shell structure, measured isotope masses, daughter excitation, and transition selection rules are not included."
        : "The estimate uses a liquid-drop binding-energy formula and standard nucleon/electron mass differences. It is most limited for light nuclei and close to thresholds; it does not include measured atomic masses, daughter excitation, or transition selection rules.";
    const caption = mode === "alpha" ? "A compact ⁴He nucleus carries away 2 protons and 2 neutrons." : mode === "betaMinus" ? "A neutron becomes a proton; an electron and electron antineutrino leave." : mode === "betaPlus" ? "A proton becomes a neutron; a positron and electron neutrino leave." : "The excited nucleus loses energy as a photon; Z, N, and A stay the same.";
    $("decayCanvasTag").textContent = `${p.a}${mode === "gamma" ? (isTc99mPreset ? "m" : "*") : ""}${sym.toUpperCase()} · ${mode.toUpperCase()}`;
    prepareEvent();
    refreshCloudEvents();
    $("decayPlay").disabled = !canEmit();
    $("decayStep").disabled = !canEmit();
    $("clockPlay").disabled = !canEmit();
    if (!canEmit()) setClockPlaying(false);
    if (!canEmit()) $("decayEventCaption").textContent = "No outgoing event: choose a valid nucleus with positive Q in this model.";
    if (!eventRunning && !eventComplete && canEmit()) $("decayEventCaption").textContent = caption;
    updateHalfLifeReadouts();
    renderNuclideMap(); drawDecayCanvas(); drawDecayCloud();
  }

  function updateEnergyPartition() {
    const isBeta = mode === "betaMinus" || mode === "betaPlus";
    $("betaEnergyControl").hidden = !isBeta;
    $("betaShare").disabled = $("betaSampling").value !== "manual";
    const e = currentEvent;
    $("eventSpeed").textContent = "";
    if (!e) {
      $("energyPartitionResult").textContent = "No outgoing kinetic-energy budget for this composition and mode.";
      $("energyPartitionNote").textContent = "The liquid-drop estimate is approximate. A negative model Q is not proof that every real transition is forbidden.";
      if (isBeta) drawBetaSpectrum();
      return;
    }
    const energyText = value => value < .001 ? `${(value * 1e6).toPrecision(3)} eV` : `${(value * 1000).toFixed(2)} keV`;
    const names = { alpha: "Alpha", betaMinus: "Electron", betaPlus: "Positron", neutrino: mode === "betaMinus" ? "Antineutrino" : "Neutrino", gamma: "Photon" };
    $("energyPartitionResult").textContent = [...e.products.map(p => `${names[p.kind]}: ${energyText(p.energy)}`), `Daughter recoil: ${energyText(e.recoil.energy)}`].join(" · ");
    const first = e.products[0];
    $("eventSpeed").textContent = `${names[first.kind]} speed: ${(first.speed * 100).toFixed(2)}% c · recoil: ${(e.recoil.speed * 299792458).toPrecision(3)} m/s`;
    $("energyPartitionNote").textContent = isBeta
      ? "Energy and all three momentum components balance. Energies follow an approximate allowed spectrum; beta–neutrino angular correlations are omitted. Manual mode explores possible energy shares."
      : mode === "alpha" ? "Equal and opposite momenta. Relativistic two-body energy split, with the daughter mass approximated by A × u."
      : `Photon energy + recoil = ${energyText(e.q)} level gap. The recoil displacement is enlarged in the animation.`;
    if (isBeta) {
      const end = physics.endpoint(e.q, e.recoil.mass);
      $("betaShareValue").textContent = `${(100 * first.energy / end).toFixed(1)}%`;
      drawBetaSpectrum();
    }
  }

  function drawBetaSpectrum() {
    const canvas = $("betaSpectrum"), c = canvas.getContext("2d");
    const { w, h } = fitCanvas(canvas, c);
    if (!w || !h) return;
    c.clearRect(0, 0, w, h);
    if (!currentEvent || !mode.startsWith("beta")) return;
    const spec = physics.spectrum(currentEvent.q, currentEvent.recoil.mass, daughter().z, mode === "betaPlus");
    const peak = Math.max(...spec.weights), left = 8, bottom = h - 21, plotW = w - 20, plotH = h - 31;
    c.beginPath(); c.moveTo(left, bottom);
    spec.weights.forEach((weight, i) => c.lineTo(left + plotW * i / 512, bottom - plotH * weight / peak));
    c.lineTo(left + plotW, bottom); c.closePath(); c.fillStyle = "rgba(123,174,227,.17)"; c.fill();
    c.strokeStyle = modes[mode].color; c.lineWidth = 1.5; c.stroke();
    const x = left + plotW * currentEvent.products[0].energy / spec.end;
    c.strokeStyle = "#dfa820"; c.beginPath(); c.moveTo(x, 5); c.lineTo(x, bottom); c.stroke();
    c.font = `9px ${MONO}`; c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--muted");
    c.textAlign = "left"; c.fillText("0", left, h - 5); c.textAlign = "right"; c.fillText(`${(spec.end * 1000).toFixed(1)} keV`, w - 4, h - 5);
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
    eventRunning = false; eventComplete = false; eventProgress = 0; currentEvent = null;
    if (loopTimeout) clearTimeout(loopTimeout);
    loopTimeout = null; dirty = true;
    $("decayRunState").textContent = "READY";
    $("decayPlay").querySelector("span").textContent = "Animate decay";
    $("decayPlay").firstChild.textContent = "▶ ";
  }
  function finishEvent() {
    eventRunning = false; eventComplete = true; eventProgress = 1; eventCount++;
    $("decayRunState").textContent = "EVENT SHOWN";
    $("decayPlay").querySelector("span").textContent = "New decay";
    $("decayPlay").firstChild.textContent = "▶ ";
    $("decayEventCaption").textContent = "One event, balanced in 3D. Drag to inspect its directions; New decay samples another event.";
    if ($("decayAuto").checked) loopTimeout = setTimeout(() => { clearEvent(); prepareEvent(); startEvent(); }, 900);
  }
  function startEvent() {
    if (!canEmit()) return;
    if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
    if (eventComplete || eventProgress >= 1) { eventProgress = 0; eventComplete = false; prepareEvent(); }
    if (!currentEvent) prepareEvent();
    eventRunning = !eventRunning; eventLast = performance.now(); dirty = true;
    $("decayRunState").textContent = eventRunning ? "ANIMATING" : "PAUSED";
    $("decayPlay").querySelector("span").textContent = eventRunning ? "Pause animation" : "Continue animation";
    $("decayPlay").firstChild.textContent = eventRunning ? "Ⅱ " : "▶ ";
    $("decayEventCaption").textContent = "Random 3D emission directions. Recoil balances the outgoing momentum. Distances and times are enlarged.";
  }
  function stepEvent() {
    if (!canEmit()) return;
    if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
    eventRunning = false;
    if (eventComplete) { eventProgress = 0; eventComplete = false; prepareEvent(); }
    if (!currentEvent) prepareEvent();
    eventProgress = Math.min(1, eventProgress + .25); dirty = true;
    $("decayRunState").textContent = `STEP ${Math.round(eventProgress * 4)}/4`;
    $("decayEventCaption").textContent = "Step through the same event. Drag the chamber to inspect the recoil direction.";
    $("decayPlay").querySelector("span").textContent = "Continue animation";
    $("decayPlay").firstChild.textContent = "▶ ";
    if (eventProgress >= 1) finishEvent();
  }

  function fitCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height };
  }
  function project(v, camera, w, h, scale = .35) {
    const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw), cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const x = v[0] * cy + v[2] * sy, z = -v[0] * sy + v[2] * cy;
    const y = v[1] * cp - z * sp, depth = v[1] * sp + z * cp, perspective = 4 / (4 - depth);
    return { x: w / 2 + x * Math.min(w, h) * scale * perspective, y: h / 2 - y * Math.min(w, h) * scale * perspective, z: depth, size: perspective };
  }
  function chamberBackground(c, camera, w, h) {
    const bg = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * .7);
    bg.addColorStop(0, "#1b3027"); bg.addColorStop(1, "#07110f");
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    for (let axis = 0; axis < 3; axis++) {
      c.beginPath();
      for (let i = 0; i <= 96; i++) {
        const angle = i * Math.PI / 48, v = [0, 0, 0];
        v[(axis + 1) % 3] = 1.12 * Math.cos(angle); v[(axis + 2) % 3] = 1.12 * Math.sin(angle);
        const p = project(v, camera, w, h);
        if (!i) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
      }
      c.strokeStyle = "rgba(167,207,183,.18)"; c.lineWidth = .8; c.stroke();
      const v = [0, 0, 0]; v[axis] = 1.22;
      const p = project(v, camera, w, h); c.font = `9px ${MONO}`; c.fillStyle = "#8da797"; c.fillText(["X", "Y", "Z"][axis], p.x, p.y);
    }
  }
  function bead(c, p, radius, color) {
    const r = Math.max(.7, radius * p.size);
    c.save(); c.globalAlpha *= Math.min(1, Math.max(.35, .75 + .18 * p.z));
    const shine = c.createRadialGradient(p.x - r * .3, p.y - r * .35, r * .05, p.x, p.y, r);
    shine.addColorStop(0, "#fff8df"); shine.addColorStop(.32, color); shine.addColorStop(1, "#14231d");
    c.fillStyle = shine; c.beginPath(); c.arc(p.x, p.y, r, 0, 2 * Math.PI); c.fill(); c.restore();
  }
  function drawNucleus3D(c, position, nucleus, camera, w, h) {
    const count = Math.min(96, nucleus.a), r = .12 + .024 * Math.cbrt(nucleus.a), points = [];
    const random = seedRandom(408);
    for (let i = 0; i < count; i++) {
      const v = physics.scale(physics.direction(random), r * Math.cbrt(random()));
      // Intermix representative proton and neutron dots rather than segregating them.
      const proton = ((i * .61803398875) % 1) < nucleus.z / nucleus.a;
      points.push({ ...project(physics.add(position, v), camera, w, h), color: proton ? "#efb74d" : "#89bca0" });
    }
    points.sort((a, b) => a.z - b.z).forEach(p => bead(c, p, Math.max(2.5, 5.5 - count / 32), p.color));
    return r;
  }
  function line3D(c, start, end, camera, w, h, color, dashed = false, opacity = .7) {
    const a = project(start, camera, w, h), b = project(end, camera, w, h);
    c.save(); c.globalAlpha = opacity; c.strokeStyle = color; c.lineWidth = dashed ? 1 : 1.6;
    c.setLineDash(dashed ? [3, 5] : []); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
  }
  function drawDecayCanvas() {
    const { w, h } = fitCanvas(decayCanvas, decayCtx);
    if (!w || !h) return;
    const c = decayCtx, e = currentEvent, travel = Math.max(0, (eventProgress - .16) / .84), emitted = travel > 0 && e;
    chamberBackground(c, eventCamera, w, h);
    const recoilPosition = emitted ? physics.scale(unit(e.recoil.momentum), travel * .23) : [0, 0, 0];
    const nucleus = emitted ? daughter() : parent(), nucleusPoint = project(recoilPosition, eventCamera, w, h);
    const items = [];
    if (emitted) {
      line3D(c, [0, 0, 0], recoilPosition, eventCamera, w, h, "#91bd9b", true);
      for (const product of e.products) {
        const relativeSpeed = product.kind === "alpha" ? 1 : .45 + .55 * Math.sqrt(product.speed);
        const position = physics.scale(unit(product.momentum), travel * 1.2 * relativeSpeed);
        line3D(c, [0, 0, 0], position, eventCamera, w, h, product.kind === "neutrino" ? "#d8e5ce" : modes[mode].color, product.kind === "neutrino");
        items.push({ product, position, point: project(position, eventCamera, w, h) });
      }
    }
    const drawProduct = item => {
      const { product, position, point } = item;
      const color = product.kind === "neutrino" ? "#d8e5ce" : modes[mode].color;
      if (product.kind === "alpha") {
        [[-.025,-.025,0],[.025,-.025,0],[-.025,.025,0],[.025,.025,0]].forEach((v, i) => bead(c, project(physics.add(position, v), eventCamera, w, h), 4, i % 2 ? "#89bca0" : "#efb74d"));
      } else bead(c, point, product.kind === "neutrino" ? 3 : 5, color);
      const label = { alpha: "α · ⁴He", betaMinus: "e⁻", betaPlus: "e⁺", neutrino: mode === "betaMinus" ? "ν̄ₑ" : "νₑ", gamma: "γ" }[product.kind];
      c.font = `600 12px ${MONO}`; c.textAlign = "center"; c.fillStyle = "#f3ecd8";
      c.fillText(label, Math.max(30, Math.min(w - 30, point.x)), Math.max(40, Math.min(h - 40, point.y - 13)));
    };
    items.filter(item => item.point.z < nucleusPoint.z).forEach(drawProduct);
    const radius = drawNucleus3D(c, recoilPosition, nucleus, eventCamera, w, h);
    items.filter(item => item.point.z >= nucleusPoint.z).forEach(drawProduct);
    c.textAlign = "center"; c.fillStyle = "#f2e7ca"; c.font = `600 11px ${MONO}`;
    c.fillText(`${nucleus.a}${mode === "gamma" && !emitted ? "*" : ""}${elementSymbol(nucleus.z)} · ${nucleus.z}p ${nucleus.n}n`, nucleusPoint.x, nucleusPoint.y + Math.min(w,h) * .35 * radius + 22);
    c.font = `9px ${MONO}`; c.fillStyle = "#b0c7b6";
    c.fillText(emitted ? "DAUGHTER RECOIL · DISPLACEMENT ENLARGED" : "PARENT AT REST · 3D VIEW", w / 2, 27);
    c.fillStyle = "#90a697"; c.fillText("SCHEMATIC SIZES, DISTANCES & FLIGHT TIMES", w / 2, h - 13);
    if (!canEmit()) { c.fillStyle = "#e5b885"; c.fillText("NO POSITIVE-Q EVENT IN THIS MODEL", w / 2, h - 32); }
  }
  function bindOrbit(canvas, camera, resetId) {
    let drag = null;
    canvas.addEventListener("pointerdown", e => { if (e.button !== 0) return; drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true }); });
    canvas.addEventListener("pointermove", e => {
      if (!drag) return;
      camera.yaw += (e.clientX - drag[0]) * .009;
      camera.pitch = Math.max(-1.45, Math.min(1.45, camera.pitch + (e.clientY - drag[1]) * .009));
      drag = [e.clientX, e.clientY]; dirty = true;
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(name, () => { drag = null; });
    canvas.addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(e.key)) return;
      e.preventDefault();
      camera.yaw += e.key === "ArrowLeft" ? -.15 : e.key === "ArrowRight" ? .15 : 0;
      camera.pitch = Math.max(-1.45, Math.min(1.45, camera.pitch + (e.key === "ArrowUp" ? .15 : e.key === "ArrowDown" ? -.15 : 0)));
      if (e.key === "Home") { camera.yaw = -.35; camera.pitch = .25; }
      dirty = true;
    });
    $(resetId).addEventListener("click", () => { camera.yaw = -.35; camera.pitch = .25; dirty = true; });
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
    decayTimes = Array.from({ length: n0 }, () => physics.lifetime()).sort((a, b) => a - b);
    const shown = Math.min(n0, 150), indices = Array.from({ length: n0 }, (_, i) => i);
    cloudParticles = [];
    // Partial Fisher–Yates: an unbiased representative sample, with no duplicate loop.
    for (let i = 0; i < shown; i++) {
      const j = i + Math.floor(Math.random() * (n0 - i));
      [indices[i], indices[j]] = [indices[j], indices[i]];
      cloudParticles.push({ decayTime: decayTimes[indices[i]], position: physics.scale(physics.direction(), .55 * Math.cbrt(Math.random())), seed: Math.floor(Math.random() * 4294967296) });
    }
    refreshCloudEvents();
    $("cloudCountLabel").textContent = `${shown} of ${formatNumber(n0)} nuclei shown`;
    updateHalfLifeReadouts(); dirty = true;
  }
  function updateHalfLifeReadouts() {
    const n0 = Number($("sampleSlider").value), pSurvive = 2 ** -elapsed;
    const expected = n0 * pSurvive, inputValue = Number($("halfLifeValue").value), unit = $("halfLifeUnit").value;
    const validTime = Number.isFinite(inputValue) && inputValue > 0;
    $("halfLifeValue").setAttribute("aria-invalid", String(!validTime));
    randomRemaining = survivorsAt(elapsed);
    const unitLabels = { s: "seconds", min: "minutes", h: "hours", d: "days", y: "years" };
    const seconds = { s: 1, min: 60, h: 3600, d: 86400, y: 365.25 * 86400 };
    $("elapsedValue").textContent = `${elapsed.toFixed(2)} T½`;
    $("elapsedClock").textContent = `${elapsed.toFixed(2)} half-lives`;
    $("sampleValue").textContent = formatNumber(n0);
    $("expectedRemaining").textContent = formatNumber(expected);
    $("sampleRemaining").textContent = formatNumber(randomRemaining);
    $("remainingFraction").textContent = `${(pSurvive * 100).toFixed(2)}%`;
    $("elapsedReal").textContent = validTime ? `${Number((inputValue * elapsed).toPrecision(3)).toLocaleString()} ${unitLabels[unit]}` : "Enter a positive half-life";
    const activity = validTime ? Math.LN2 * expected / (inputValue * seconds[unit]) : null;
    $("activityValue").textContent = activity === null ? "—" : `${activity < .01 || activity >= 10000 ? activity.toExponential(2) : activity.toPrecision(3)} Bq`;
    $("countSpread").textContent = `±${Math.sqrt(n0 * pSurvive * (1 - pSurvive)).toFixed(1)}`;
    const preset = (presets[mode] || []).find(p => p.value === presetSelect.value);
    $("halfLifeSource").textContent = preset && inputValue === preset.halfLife && unit === preset.halfLifeUnit ? "Preset parent half-life · decay branches not weighted" : "User-chosen half-life · not inferred from nuclear composition";
    drawHalfLifeChart(expected, randomRemaining, n0, elapsed);
  }
  function drawDecayCloud() {
    const { w, h } = fitCanvas(decayCloudCanvas, decayCloudCtx);
    if (!w || !h) return;
    const c = decayCloudCtx;
    chamberBackground(c, cloudCamera, w, h);
    const objects = []; let visibleParents = 0, visibleDaughters = 0;
    for (const particle of cloudParticles) {
      const age = elapsed - particle.decayTime, e = particle.event;
      if (age < 0 || !e) {
        visibleParents++;
        objects.push({ point: project(particle.position, cloudCamera, w, h), radius: 2.8, color: "#efb74d" });
        continue;
      }
      visibleDaughters++;
      const t = Math.min(1, age / .32), daughterPosition = physics.add(particle.position, physics.scale(unit(e.recoil.momentum), .06 * t));
      objects.push({ point: project(daughterPosition, cloudCamera, w, h), radius: 2.5, color: "#8fbea0" });
      if (age > .32) continue;
      for (const product of e.products) {
        const relativeSpeed = product.kind === "alpha" ? .6 : .5 + .5 * product.speed;
        const distance = t * 1.1 * relativeSpeed;
        const position = physics.add(particle.position, physics.scale(unit(product.momentum), distance));
        const color = product.kind === "neutrino" ? "#d8e5ce" : modes[mode].color;
        line3D(c, particle.position, position, cloudCamera, w, h, color, product.kind === "neutrino", .8 * (1 - t));
        objects.push({ point: project(position, cloudCamera, w, h), radius: 1.8, color, opacity: 1 - t });
      }
    }
    objects.sort((a,b) => a.point.z - b.point.z).forEach(o => { c.save(); c.globalAlpha = o.opacity ?? 1; bead(c, o.point, o.radius, o.color); c.restore(); });
    const label = canEmit() ? `${visibleParents} parents · ${visibleDaughters} daughters shown` : "Choose a positive-Q transition to view emissions.";
    if ($("cloudReadout").textContent !== label) $("cloudReadout").textContent = label;
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
    const point = (t, n) => [padL + plotW * t / 6, padT + plotH * (1 - n / start)];
    halfCtx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = i / 20, prob = 2 ** -t, sd = Math.sqrt(start * prob * (1 - prob));
      const [x, y] = point(t, Math.min(start, start * prob + sd));
      if (!i) halfCtx.moveTo(x, y); else halfCtx.lineTo(x, y);
    }
    for (let i = 120; i >= 0; i--) {
      const t = i / 20, prob = 2 ** -t, sd = Math.sqrt(start * prob * (1 - prob));
      halfCtx.lineTo(...point(t, Math.max(0, start * prob - sd)));
    }
    halfCtx.closePath(); halfCtx.fillStyle = "rgba(123,174,227,.20)"; halfCtx.fill();
    halfCtx.beginPath(); halfCtx.moveTo(...point(0, start));
    let count = start;
    for (const t of decayTimes) {
      if (t > elapsed) break;
      halfCtx.lineTo(...point(t, count)); halfCtx.lineTo(...point(t, --count));
    }
    halfCtx.lineTo(...point(elapsed, count)); halfCtx.strokeStyle = "#7baee3"; halfCtx.lineWidth = 1.3; halfCtx.stroke();
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

  modeButtons.forEach((button, i) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
    button.addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); const j = e.key === "Home" ? 0 : e.key === "End" ? 3 : (i + (e.key === "ArrowRight" ? 1 : 3)) % 4;
      modeButtons[j].focus(); setMode(modeButtons[j].dataset.mode);
    });
  });
  elementSelect.addEventListener("change", () => clampInputs("element"));
  zInput.addEventListener("change", () => clampInputs("z"));
  nInput.addEventListener("change", () => clampInputs("n"));
  presetSelect.addEventListener("change", () => { clearEvent(); if (presetSelect.value === "custom") updateDecayReadouts(); else applyPreset(presetSelect.value); });
  $("gammaEnergy").addEventListener("input", () => { clearEvent(); updateDecayReadouts(); });
  for (const id of ["betaShare", "betaSampling"]) $(id).addEventListener("input", () => { clearEvent(); prepareEvent(); });
  $("decayPlay").addEventListener("click", startEvent);
  $("decayStep").addEventListener("click", stepEvent);
  $("decayReset").addEventListener("click", () => { clearEvent(); updateDecayReadouts(); });
  $("decayAuto").addEventListener("change", () => { if (!$("decayAuto").checked && loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; } });
  $("elapsedSlider").addEventListener("input", () => { elapsed = Number($("elapsedSlider").value); updateHalfLifeReadouts(); dirty = true; });
  $("sampleSlider").addEventListener("input", rerollSample);
  $("halfLifeValue").addEventListener("input", updateHalfLifeReadouts);
  $("halfLifeUnit").addEventListener("change", updateHalfLifeReadouts);
  $("clockReroll").addEventListener("click", rerollSample);
  $("clockRate").addEventListener("input", () => { $("clockRateValue").textContent = `${Number($("clockRate").value).toFixed(2)} T½/s`; });
  function setClockPlaying(value) {
    clockPlaying = value;
    const button = $("clockPlay");
    button.setAttribute("aria-pressed", String(value));
    button.setAttribute("aria-label", `${value ? "Pause" : "Play"} half-life decay animation`);
    button.innerHTML = `${value ? "Ⅱ" : "▶"} <span>${value ? "Pause" : "Play"}</span>`;
  }
  $("clockPlay").addEventListener("click", () => {
    if (!canEmit()) return;
    if (elapsed >= 6) { elapsed = 0; $("elapsedSlider").value = "0"; updateHalfLifeReadouts(); }
    setClockPlaying(!clockPlaying); dirty = true;
  });
  bindOrbit(decayCanvas, eventCamera, "eventViewReset");
  bindOrbit(decayCloudCanvas, cloudCamera, "cloudViewReset");
  new ResizeObserver(() => { dirty = true; updateHalfLifeReadouts(); drawBetaSpectrum(); }).observe($("decay-title").parentElement);
  window.addEventListener("resize", () => { dirty = true; updateHalfLifeReadouts(); drawBetaSpectrum(); });
  new MutationObserver(() => { dirty = true; renderNuclideMap(); updateHalfLifeReadouts(); drawBetaSpectrum(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  populatePresets(false);
  setMode("alpha", false);
  rerollSample();
  function animateDecay(now) {
    const dt = document.hidden ? 0 : Math.min(.05, Math.max(0, (now - eventLast) / 1000));
    eventLast = now;
    if (document.hidden) { requestAnimationFrame(animateDecay); return; }
    if (clockPlaying) {
      elapsed = Math.min(6, elapsed + dt * Number($("clockRate").value));
      $("elapsedSlider").value = String(elapsed);
      if (now - lastReadoutTime >= 100 || elapsed >= 6) { updateHalfLifeReadouts(); lastReadoutTime = now; }
      if (elapsed >= 6) setClockPlaying(false);
      dirty = true;
    }
    if (eventRunning) {
      eventProgress = Math.min(1, eventProgress + dt * Number($("decaySpeed").value) / 2.7);
      if (eventProgress >= 1) finishEvent();
      dirty = true;
    }
    if ($("eventRotate").checked) { eventCamera.yaw += dt * .24; dirty = true; }
    if ($("cloudRotate").checked) { cloudCamera.yaw += dt * .2; dirty = true; }
    if (dirty) { drawDecayCanvas(); drawDecayCloud(); dirty = false; }
    currentFrame = requestAnimationFrame(animateDecay);
  }
  eventLast = performance.now(); currentFrame = requestAnimationFrame(animateDecay);
})();
