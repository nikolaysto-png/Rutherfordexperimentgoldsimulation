# Interactive Nuclear Physics Lab

A buildless, browser-based physics lesson with two interactive labs. The Rutherford chamber integrates alpha particles through the Coulomb field of a gold nucleus. The decay lab animates alpha, beta-minus, beta-plus, and gamma transitions, maps the proton/neutron changes, and models a sample's half-life curve.

## Run it

Open `index.html` in a browser, or serve the repository folder locally:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. The site has no package install, build step, backend, or external font dependency.

## Controls

- **Alpha energy:** changes the kinetic energy of newly fired particles and clears the counts so the comparison stays within one energy setting.
- **Beam intensity:** changes how many alpha particles are launched each second.
- **Show predicted paths:** toggles the dashed Rutherford reference paths.
- **Pause:** freezes the animation and detector. **Reset counts** clears particles and measurements.
- **Theme:** switches between light and dark page themes; the choice is stored in this browser.

## Decay lab

- Select α, β⁻, β⁺, or γ; load a worked isotope example or enter any element (Z) and neutron count (N).
- Animate a transition, step it frame by frame, adjust animation speed, or turn on looping.
- Read the parent/daughter conservation ledger and use the clickable N–Z map to select nearby nuclei. Selection changes animate and report the change in Z and N.
- Inspect a Q-value teaching gate. Worked isotope examples use evaluated NNDC/ENSDF transition values; other nuclei use a liquid-drop estimate and are not evaluated decay predictions.
- Use the half-life clock to compare the expected exponential survivor count with one random sample. The same individual decay times persist while scrubbing; Play advances the same sample and stops at six half-lives. Activity is shown in becquerels, with a binomial counting-uncertainty band.
- Orbit the decay event and population chamber by dragging, using arrow keys, or enabling automatic rotation. Directions are sampled isotropically over a 3D sphere. Up to 150 representative nuclei show emission and daughter recoil.
- Sample an approximate continuous beta spectrum, or choose a manual energy fraction. The energy ledger includes daughter recoil and particle speeds.
- Alpha and gamma use opposite recoil; beta events conserve momentum across the electron/positron, neutrino and daughter.
- Rutherford trajectories start on a finite-distance Coulomb orbit and compare asymptotic scattering angles, with automatic zoom for low-energy particles.

The gamma example uses the 140.5 keV Tc-99m transition. The beta-plus view shows positron emission; electron capture and internal conversion are not animated.

## Model limits

The demo follows one alpha particle at a time around one gold nucleus in a 2D slice. It uses Coulomb repulsion and a finite-size nucleus, but omits the foil lattice, electrons, nuclear forces, and the 3D impact-parameter distribution. The histogram shows a useful pattern, not a reconstruction of the original measured foil data.

The decay visuals preserve proton, neutron, and mass-number bookkeeping. The semi-empirical mass-formula Q gate can be inaccurate, especially for light nuclei, nuclei near thresholds, or excited-state transitions. It does not calculate half-lives, branching ratios, or conversion-electron competition. The beta spectrum uses an approximate allowed shape with a point-Coulomb correction; it is not a measured spectrum. Nuclear masses for recoil are approximated by A times the atomic mass unit. Beta-neutrino angular correlations are omitted. Nuclear sizes, flight distances, animation time and recoil visibility are schematic. Subsequent daughter decays, positron annihilation and detector interactions are not simulated. Use the linked NNDC NuDat/ENSDF records for evaluated nuclear data.

## Source files

- `physics.js`: decay kinematics, spectrum sampling, lifetime sampling and Coulomb orbit helpers.
- `rutherford.js`: scattering chamber and detector UI.
- `app.js`: decay lab, nuclide map and half-life population.
- `index.html` and `styles.css`: accessible controls and responsive layout.

GitHub Pages serves these files from the main branch and repository root.

Physics reference: [Geant4 radioactive decay model](https://geant4.web.cern.ch/documentation/dev/prm_html/PhysicsReferenceManual/hadronic/Radioactive/radDecay.html). Evaluated isotope references are linked next to their worked examples in the website.
