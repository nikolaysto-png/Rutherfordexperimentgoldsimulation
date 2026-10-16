# Rutherford Scattering and Radioactive Decay Lab

A buildless, interactive physics lesson combining the Rutherford gold foil experiment with alpha, beta-minus, beta-plus, and gamma decay simulations.

## Run locally

From the repository root, run:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000. No build step or package installation is required.

## What is included

- A live Rutherford scattering chamber, detector counts, and angle histogram.
- Four nuclear decay modes with conservation bookkeeping and an interactive proton-neutron map.
- A half-life clock with a stable random sample and a 2D chamber showing randomly directed emissions.

The half-life chamber displays a 2D projection with emission azimuths sampled over 360°. It illustrates direction and population change; it is not a 3D detector simulation. The decay-energy model and sample animation do not predict real half-lives or branching ratios.

See the in-page model notes and linked NNDC references for the limitations of each approximation.
