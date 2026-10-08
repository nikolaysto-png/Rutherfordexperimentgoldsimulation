import { useState } from 'react';
import SimulationCanvas from './components/SimulationCanvas';

export default function App() {
  const [speed, setSpeed] = useState(0.5);
  const [isRunning, setIsRunning] = useState(true);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
              <span className="text-lg">⚛</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-yellow-300">
                Rutherford Gold Foil Experiment
              </h1>
              <p className="text-xs text-gray-400">Interactive Physics Simulation • 1911</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Simulation */}
        <div className="mb-6 flex justify-center">
          <SimulationCanvas speed={speed} isRunning={isRunning} />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Speed Control */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              ⚡ Particle Speed
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Slow</span>
                <span className="text-lg font-mono font-bold text-blue-400">
                  {(1.5 + speed * 4).toFixed(1)} <span className="text-xs text-gray-500">units/f</span>
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
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Low energy</span>
                <span>High energy</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                  isRunning
                    ? 'bg-yellow-900 text-yellow-300 border border-yellow-700 hover:bg-yellow-800'
                    : 'bg-green-900 text-green-300 border border-green-700 hover:bg-green-800'
                }`}
              >
                {isRunning ? '⏸ Pause' : '▶ Resume'}
              </button>
              <button
                onClick={() => setSpeed(0.5)}
                className="py-2 px-4 rounded-lg font-medium text-sm bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              📋 Legend
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <div>
                  <p className="text-sm text-gray-200">Alpha Particle (He²⁺)</p>
                  <p className="text-xs text-gray-500">+2 charge, mass ~4 u</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                <div>
                  <p className="text-sm text-gray-200">Gold Nucleus (Au)</p>
                  <p className="text-xs text-gray-500">+79 charge, mass ~197 u</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-1 bg-orange-400 rounded"></div>
                <div>
                  <p className="text-sm text-gray-200">Undeflected Trail</p>
                  <p className="text-xs text-gray-500">Passes through foil</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-1 bg-red-500 rounded"></div>
                <div>
                  <p className="text-sm text-gray-200">Deflected Trail</p>
                  <p className="text-xs text-gray-500">Large angle scattering</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Insight */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              💡 Key Insight
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>
                <span className="text-yellow-400 font-semibold">Most</span> alpha particles pass straight through → atom is mostly empty space.
              </p>
              <p>
                <span className="text-red-400 font-semibold">Few</span> deflect at large angles → positive charge is in a tiny nucleus.
              </p>
              <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700">
                ⚡ Slower particles spend more time near nuclei and deflect more strongly.
              </p>
            </div>
          </div>
        </div>

        {/* Educational Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-bold text-yellow-400 mb-3">The Experiment (1911)</h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">
              Ernest Rutherford, Hans Geiger, and Ernest Marsden fired alpha particles at a thin gold foil. 
              According to the "plum pudding" model, positive charge was spread throughout the atom, 
              so particles should pass through with minimal deflection.
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Instead, a small fraction were deflected at very large angles — some bounced back! 
              Rutherford said this was "as if you fired a 15-inch shell at tissue paper and it came back and hit you."
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-3">The Physics</h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">
              Deflection is caused by <span className="text-blue-300">Coulomb repulsion</span> between the 
              alpha particle (+2e) and gold nucleus (+79e). The force follows:
            </p>
            <div className="bg-gray-950 rounded-lg p-3 text-center font-mono text-sm text-blue-300 mb-3">
              F = k · q₁ · q₂ / r²
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Faster particles have less interaction time per nucleus, so they deflect less. 
              Try the speed slider to see this effect!
            </p>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-gray-600 pb-6">
          <p>Interactive Rutherford Gold Foil Experiment Simulation</p>
        </footer>
      </main>
    </div>
  );
}
