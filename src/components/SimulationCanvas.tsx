import { useRef, useEffect, useState } from 'react';

interface AlphaParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  trail: { x: number; y: number }[];
  deflected: boolean;
}

interface GoldNucleus {
  x: number;
  y: number;
  radius: number;
}

interface SimulationCanvasProps {
  speed: number;
  isRunning: boolean;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;
const FOIL_X = 400;
const FOIL_WIDTH = 40;
const NUCLEUS_RADIUS = 4;
const ALPHA_RADIUS = 3;
const COULOMB_CONSTANT = 800;
const ALPHA_CHARGE = 2;
const GOLD_CHARGE = 79;

export default function SimulationCanvas({ speed, isRunning }: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<AlphaParticle[]>([]);
  const nucleiRef = useRef<GoldNucleus[]>([]);
  const frameCountRef = useRef(0);
  const speedRef = useRef(speed);
  const isRunningRef = useRef(isRunning);
  const [stats, setStats] = useState({ total: 0, deflected: 0, passed: 0 });

  // Keep refs in sync
  speedRef.current = speed;
  isRunningRef.current = isRunning;

  // Initialize nuclei
  useEffect(() => {
    const nuclei: GoldNucleus[] = [];
    const rows = 12;
    const cols = 3;
    const spacingY = CANVAS_HEIGHT / (rows + 1);
    const spacingX = FOIL_WIDTH / (cols + 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nuclei.push({
          x: FOIL_X + spacingX * (c + 1) + (r % 2 === 0 ? spacingX * 0.3 : 0),
          y: spacingY * (r + 1),
          radius: NUCLEUS_RADIUS,
        });
      }
    }
    nucleiRef.current = nuclei;

    // Spawn initial particles
    for (let i = 0; i < 5; i++) {
      const baseSpeed = 1.5 + speedRef.current * 3.5;
      const yOffset = Math.random() * CANVAS_HEIGHT;
      particlesRef.current.push({
        x: -10 - i * 30,
        y: yOffset,
        vx: baseSpeed,
        vy: 0,
        active: true,
        trail: [],
        deflected: false,
      });
    }
  }, []);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let deflectedCount = 0;
    let passedCount = 0;

    function createParticle(): AlphaParticle {
      const baseSpeed = 1.5 + speedRef.current * 3.5;
      const yOffset = Math.random() * CANVAS_HEIGHT;
      return {
        x: -10,
        y: yOffset,
        vx: baseSpeed,
        vy: 0,
        active: true,
        trail: [],
        deflected: false,
      };
    }

    function applyCoulombForce(particle: AlphaParticle) {
      const nuclei = nucleiRef.current;
      const currentSpeed = speedRef.current;
      let totalFx = 0;
      let totalFy = 0;

      for (const nucleus of nuclei) {
        const dx = particle.x - nucleus.x;
        const dy = particle.y - nucleus.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist < 8) {
          const force = COULOMB_CONSTANT * ALPHA_CHARGE * GOLD_CHARGE / (distSq + 10);
          totalFx += (force * dx) / dist;
          totalFy += (force * dy) / dist;
          particle.deflected = true;
        } else if (dist < 80) {
          const force = COULOMB_CONSTANT * ALPHA_CHARGE * GOLD_CHARGE / (distSq + 50);
          totalFx += (force * dx) / dist;
          totalFy += (force * dy) / dist;
          if (dist < 40) particle.deflected = true;
        }
      }

      const speedFactor = 1 / (1 + currentSpeed * 0.8);
      particle.vx += totalFx * speedFactor * 0.0001;
      particle.vy += totalFy * speedFactor * 0.0001;
    }

    function update() {
      const particles = particlesRef.current;

      for (const particle of particles) {
        if (!particle.active) continue;

        applyCoulombForce(particle);

        particle.x += particle.vx;
        particle.y += particle.vy;

        particle.trail.push({ x: particle.x, y: particle.y });
        if (particle.trail.length > 60) {
          particle.trail.shift();
        }

        if (particle.x > CANVAS_WIDTH + 20 || particle.x < -50 ||
            particle.y > CANVAS_HEIGHT + 50 || particle.y < -50) {
          particle.active = false;
          if (particle.deflected) deflectedCount++;
          else passedCount++;
        }
      }

      particlesRef.current = particles.filter(p => p.active);

      frameCountRef.current++;
      const spawnRate = Math.max(8, 25 - speedRef.current * 5);
      if (frameCountRef.current % spawnRate === 0) {
        particlesRef.current.push(createParticle());
      }

      if (frameCountRef.current % 30 === 0) {
        const total = particlesRef.current.length;
        const defl = particlesRef.current.filter(p => p.deflected).length;
        setStats({ total: total + deflectedCount + passedCount, deflected: defl + deflectedCount, passed: passedCount });
      }
    }

    function draw() {
      if (!ctx) return;

      // Clear canvas
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw background grid
      ctx.strokeStyle = 'rgba(50, 50, 80, 0.3)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < CANVAS_WIDTH; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Draw alpha source
      ctx.fillStyle = '#ff6b35';
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 15;
      ctx.fillRect(10, CANVAS_HEIGHT / 2 - 40, 40, 80);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('α', 30, CANVAS_HEIGHT / 2 + 4);
      ctx.fillText('Source', 30, CANVAS_HEIGHT / 2 + 20);

      // Draw gold foil
      const foilGradient = ctx.createLinearGradient(FOIL_X, 0, FOIL_X + FOIL_WIDTH, 0);
      foilGradient.addColorStop(0, 'rgba(255, 215, 0, 0.15)');
      foilGradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.25)');
      foilGradient.addColorStop(1, 'rgba(255, 215, 0, 0.15)');
      ctx.fillStyle = foilGradient;
      ctx.fillRect(FOIL_X, 0, FOIL_WIDTH, CANVAS_HEIGHT);

      // Foil border
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(FOIL_X, 0, FOIL_WIDTH, CANVAS_HEIGHT);

      // Draw gold nuclei
      const nuclei = nucleiRef.current;
      for (const nucleus of nuclei) {
        const gradient = ctx.createRadialGradient(
          nucleus.x, nucleus.y, 0,
          nucleus.x, nucleus.y, nucleus.radius * 3
        );
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 180, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(nucleus.x, nucleus.y, nucleus.radius * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(nucleus.x, nucleus.y, nucleus.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Au', nucleus.x, nucleus.y + nucleus.radius + 12);
      }

      // Draw foil label
      ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Gold Foil', FOIL_X + FOIL_WIDTH / 2, CANVAS_HEIGHT - 10);

      // Draw detector screen (arc)
      ctx.strokeStyle = 'rgba(0, 255, 150, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(FOIL_X + FOIL_WIDTH + 100, CANVAS_HEIGHT / 2, 200, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 255, 150, 0.6)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Detector', FOIL_X + FOIL_WIDTH + 320, CANVAS_HEIGHT / 2);

      // Draw particles and trails
      const particles = particlesRef.current;
      for (const particle of particles) {
        if (!particle.active) continue;

        // Draw trail
        if (particle.trail.length > 1) {
          for (let i = 1; i < particle.trail.length; i++) {
            const alpha = i / particle.trail.length;
            ctx.strokeStyle = particle.deflected
              ? `rgba(255, 100, 100, ${alpha * 0.6})`
              : `rgba(255, 150, 50, ${alpha * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(particle.trail[i - 1].x, particle.trail[i - 1].y);
            ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
            ctx.stroke();
          }
        }

        // Draw alpha particle
        const particleGradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, ALPHA_RADIUS * 2
        );
        particleGradient.addColorStop(0, particle.deflected ? '#ff4444' : '#ff8c42');
        particleGradient.addColorStop(0.5, particle.deflected ? 'rgba(255, 68, 68, 0.6)' : 'rgba(255, 140, 66, 0.6)');
        particleGradient.addColorStop(1, 'rgba(255, 100, 50, 0)');
        ctx.fillStyle = particleGradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, ALPHA_RADIUS * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = particle.deflected ? '#ff6666' : '#ffaa66';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, ALPHA_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Alpha Particles →', 60, 25);

      // Speed indicator
      ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`v = ${(1.5 + speedRef.current * 3.5).toFixed(1)} units`, CANVAS_WIDTH - 20, 25);
    }

    function animate() {
      if (isRunningRef.current) {
        update();
      }
      draw();
      animationRef.current = requestAnimationFrame(animate);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-xl border border-gray-700 shadow-2xl"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs font-mono text-gray-300">
        <div>Total: {stats.total} | Deflected: <span className="text-red-400">{stats.deflected}</span> | Passed: <span className="text-green-400">{stats.passed}</span></div>
      </div>
    </div>
  );
}
