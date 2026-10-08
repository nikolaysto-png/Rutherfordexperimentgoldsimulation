import { useState } from 'react';
import SimulationCanvas from './components/SimulationCanvas';

export default function App() {
  const [speed, setSpeed] = useState(0.5);
  const [isRunning, setIsRunning] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-lg">⚛</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-200 to-amber-400 bg-clip-text text-transparent">
                Rutherford Gold Foil Experiment
              </h1>
              <p className="text-xs text-gray-400">Interactive Physics Simulation • 1911</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Simulation */}
        <div className="mb-6">
          <SimulationCanvas speed={speed} isRunning={isRunning} />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Speed Control */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Particle Speed Control
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Slow</span>
                <span className="text-lg font-mono font-bold text-blue-400">
                  {(1.5 + speed * 3.5).toFixed(1)} <span className="text-xs text-gray-500">units/frame</span>
                </span>
                <span className="text-xs text-gray-400">Fast</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
                  [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-blue-500/50
                  [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                  [&::-webkit-slider-thumb]:hover:scale-125"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0% energy</span>
                <span>100% energy</span>
              </div>
            </div>

            {/* Play/Pause */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                  isRunning
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                    : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                }`}
              >
                {isRunning ? '⏸ Pause' : '▶ Resume'}
              </button>
              <button
                onClick={() => setSpeed(0.5)}
                className="py-2 px-4 rounded-lg font-medium text-sm bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700 transition-all"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              Legend
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30"></div>
                <div>
                  <p className="text-sm text-gray-200">Alpha Particle (He²⁺)</p>
                  <p className="text-xs text-gray-500">+2 charge, mass ~4 u</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-lg shadow-yellow-500/30"></div>
                <div>
                  <p className="text-sm text-gray-200">Gold Nucleus (Au)</p>
                  <p className="text-xs text-gray-500">+79 charge, mass ~197 u</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-0.5 bg-gradient-to-r from-orange-400 to-transparent rounded"></div>
                <div>
                  <p className="text-sm text-gray-200">Particle Trail</p>
                  <p className="text-xs text-gray-500">Orange = undeflected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-0.5 bg-gradient-to-r from-red-400 to-transparent rounded"></div>
                <div>
                  <p className="text-sm text-gray-200">Deflected Trail</p>
                  <p className="text-xs text-gray-500">Red = large angle scattering</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Insight */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Key Insight
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>
                <span className="text-amber-400 font-semibold">Most</span> alpha particles pass straight through the foil → atom is mostly empty space.
              </p>
              <p>
                <span className="text-red-400 font-semibold">Few</span> are deflected at large angles → all positive charge is concentrated in a tiny nucleus.
              </p>
              <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700">
                Try adjusting the speed: slower particles spend more time near nuclei and deflect more.
              </p>
            </div>
          </div>
        </div>

        {/* Educational Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-bold text-amber-400 mb-3">The Experiment (1911)</h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">
              Ernest Rutherford, along with Hans Geiger and Ernest Marsden, fired alpha particles at a thin gold foil. 
              According to the prevailing "plum pudding" model (Thomson, 1904), the positive charge was spread throughout the atom, 
              so alpha particles should pass through with minimal deflection.
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Instead, they observed that while most particles passed through, a small fraction were deflected at very large angles — 
              some even bounced back! Rutherford said this was "as if you fired a 15-inch shell at a piece of tissue paper and it came back and hit you."
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-3">The Physics</h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">
              The deflection is caused by <span className="text-blue-300">Coulomb repulsion</span> between the positively charged 
              alpha particle (+2e) and the gold nucleus (+79e). The force follows an inverse-square law:
            </p>
            <div className="bg-gray-900/80 rounded-lg p-3 text-center font-mono text-sm text-blue-300 mb-3">
              F = k · q₁ · q₂ / r²
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Faster particles have less time to interact with each nucleus, resulting in smaller deflection angles. 
              This is why the speed slider affects the scattering pattern — it simulates changing the kinetic energy of the alpha source.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-gray-600 pb-6">
          <p>Interactive simulation of Rutherford's gold foil experiment • Physics visualization</p>
        </footer>
      </main>
    </div>
  );
}
