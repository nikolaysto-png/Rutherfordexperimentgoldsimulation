import { useRef, useEffect, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  trail: { x: number; y: number }[];
  deflected: boolean;
}

interface Nucleus {
  x: number;
  y: number;
}

const W = 800;
const H = 450;
const FOIL_X = 350;
const FOIL_W = 30;

export default function SimulationCanvas({ speed, isRunning }: { speed: number; isRunning: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(speed);
  const runningRef = useRef(isRunning);
  const particles = useRef<Particle[]>([]);
  const nuclei = useRef<Nucleus[]>([]);
  const frame = useRef(0);
  const animId = useRef(0);
  const [deflected, setDeflected] = useState(0);
  const [passed, setPassed] = useState(0);

  speedRef.current = speed;
  runningRef.current = isRunning;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    // Create nuclei in the foil
    const ns: Nucleus[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 3; c++) {
        ns.push({
          x: FOIL_X + 5 + c * 10 + (r % 2) * 5,
          y: 25 + r * 42,
        });
      }
    }
    nuclei.current = ns;

    let deflCount = 0;
    let passCount = 0;

    function spawn() {
      const spd = 1.5 + speedRef.current * 4;
      particles.current.push({
        x: -5,
        y: 20 + Math.random() * (H - 40),
        vx: spd,
        vy: 0,
        active: true,
        trail: [],
        deflected: false,
      });
    }

    // Initial particles
    for (let i = 0; i < 4; i++) spawn();

    function step() {
      if (runningRef.current) {
        frame.current++;

        // Spawn new particles
        const rate = Math.max(10, 30 - speedRef.current * 8);
        if (frame.current % rate === 0) spawn();

        // Update particles
        for (const p of particles.current) {
          if (!p.active) continue;

          // Coulomb force from nuclei
          for (const n of nuclei.current) {
            const dx = p.x - n.x;
            const dy = p.y - n.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            if (dist < 100 && dist > 0.5) {
              const force = (2 * 79 * 500) / (distSq + 20);
              const speedFactor = 1 / (1 + speedRef.current * 1.2);
              p.vx += (force * dx / dist) * speedFactor * 0.00008;
              p.vy += (force * dy / dist) * speedFactor * 0.00008;
              if (dist < 30) p.deflected = true;
            }
          }

          p.x += p.vx;
          p.y += p.vy;
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 50) p.trail.shift();

          if (p.x > W + 30 || p.x < -30 || p.y > H + 30 || p.y < -30) {
            p.active = false;
            if (p.deflected) deflCount++;
            else passCount++;
          }
        }

        particles.current = particles.current.filter(p => p.active);

        if (frame.current % 20 === 0) {
          setDeflected(deflCount);
          setPassed(passCount);
        }
      }

      // Draw
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(40, 50, 80, 0.3)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Alpha source
      ctx.fillStyle = '#e85d26';
      ctx.fillRect(5, H / 2 - 35, 35, 70);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('α', 22, H / 2 + 5);
      ctx.font = '9px monospace';
      ctx.fillText('SOURCE', 22, H / 2 + 20);

      // Gold foil background
      ctx.fillStyle = 'rgba(255, 200, 0, 0.08)';
      ctx.fillRect(FOIL_X, 0, FOIL_W, H);
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(FOIL_X, 0, FOIL_W, H);

      // Nuclei
      for (const n of nuclei.current) {
        // Glow
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 12);
        g.addColorStop(0, 'rgba(255, 215, 0, 0.7)');
        g.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
        ctx.fill();
        // Core
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Foil label
      ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GOLD FOIL', FOIL_X + FOIL_W / 2, H - 8);

      // Detector arc
      ctx.strokeStyle = 'rgba(0, 220, 130, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(FOIL_X + 80, H / 2, 180, -0.4 * Math.PI, 0.4 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 220, 130, 0.5)';
      ctx.font = '10px monospace';
      ctx.fillText('DETECTOR', W - 60, H / 2);

      // Particles
      for (const p of particles.current) {
        if (!p.active) continue;

        // Trail
        if (p.trail.length > 1) {
          for (let i = 1; i < p.trail.length; i++) {
            const a = i / p.trail.length;
            ctx.strokeStyle = p.deflected
              ? `rgba(255, 80, 80, ${a * 0.5})`
              : `rgba(255, 160, 60, ${a * 0.35})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
            ctx.lineTo(p.trail[i].x, p.trail[i].y);
            ctx.stroke();
          }
        }

        // Particle glow
        const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6);
        pg.addColorStop(0, p.deflected ? 'rgba(255,80,80,0.9)' : 'rgba(255,160,60,0.9)');
        pg.addColorStop(1, 'rgba(255,100,50,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Particle core
        ctx.fillStyle = p.deflected ? '#ff5555' : '#ffaa55';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Labels
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('α particles →', 50, 18);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(100,200,255,0.7)';
      ctx.fillText('v=' + (1.5 + speedRef.current * 4).toFixed(1), W - 10, 18);

      animId.current = requestAnimationFrame(step);
    }

    animId.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId.current);
  }, []);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-lg border border-gray-700"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <div className="absolute top-2 left-2 bg-black/70 rounded px-2 py-1 text-xs font-mono text-gray-300">
        Deflected: <span className="text-red-400">{deflected}</span> | Passed: <span className="text-green-400">{passed}</span>
      </div>
    </div>
  );
}
