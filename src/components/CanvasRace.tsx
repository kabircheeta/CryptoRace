import React, { useEffect, useRef } from 'react';
import { Trophy } from 'lucide-react';

interface CanvasRaceProps {
  isRacing: boolean;
  winner: 'BTC' | 'ETH' | null;
  paths: { BTC: number[]; ETH: number[] } | null;
  onFinish: () => void;
  totalWinnings?: number;
}

const CanvasRace: React.FC<CanvasRaceProps> = ({ isRacing, winner, paths, onFinish, totalWinnings = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const particlesRef = useRef<any[]>([]);
  const pathsRef = useRef(paths);

  useEffect(() => {
    pathsRef.current = paths;
  }, [paths]);

  const DURATION = 5000; // 5 seconds race

  const initParticles = () => {
    const particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * 800,
        y: Math.random() * 400,
        speed: 2 + Math.random() * 5,
        size: 1 + Math.random() * 2,
        opacity: Math.random() * 0.5
      });
    }
    particlesRef.current = particles;
  };

  const animate = (time: number) => {
    if (startTimeRef.current === 0) startTimeRef.current = time;
    const elapsed = time - startTimeRef.current;
    const progress = Math.min(elapsed / DURATION, 1);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Track Background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines (Moving)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridOffset = (time / 10) % 50;
    for (let x = -gridOffset; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw Particles (Speed lines)
    particlesRef.current.forEach(p => {
      p.x -= p.speed * (isRacing ? 2 : 1);
      if (p.x < 0) p.x = canvas.width;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.fillRect(p.x, p.y, p.size * 10, p.size);
    });

    // Race Logic
    const btcY = canvas.height * 0.3;
    const ethY = canvas.height * 0.7;
    const startX = 50;
    const endX = canvas.width - 100;
    const trackWidth = endX - startX;

    // Calculate positions with some "jitter"
    const btcJitter = Math.sin(time / 200) * 5;
    const ethJitter = Math.cos(time / 250) * 5;

    let btcProgress = 0;
    let ethProgress = 0;

    if (isRacing && pathsRef.current) {
      const p = pathsRef.current;
      // Interpolate progress from paths
      const stepCount = p.BTC.length - 1;
      const currentStep = progress * stepCount;
      const index = Math.floor(currentStep);
      const frac = currentStep - index;

      const getInterpolatedPos = (path: number[]) => {
        if (index >= stepCount) return path[stepCount];
        const start = path[index];
        const end = path[index + 1];
        return start + (end - start) * frac;
      };

      const btcRaw = getInterpolatedPos(p.BTC);
      const ethRaw = getInterpolatedPos(p.ETH);

      // Normalize progress relative to the final winner's position
      // We want the winner to reach 1.0 exactly at progress 1.0
      const maxFinalPos = Math.max(p.BTC[stepCount], p.ETH[stepCount]);
      
      btcProgress = btcRaw / maxFinalPos * progress;
      ethProgress = ethRaw / maxFinalPos * progress;

      // Ensure the winner is actually ahead at the very end
      if (progress > 0.98) {
        if (winner === 'BTC') {
          btcProgress = progress;
          ethProgress = Math.min(progress, ethProgress);
        } else {
          ethProgress = progress;
          btcProgress = Math.min(progress, btcProgress);
        }
      }
    } else if (isRacing) {
        // Fallback if paths aren't ready
        btcProgress = progress;
        ethProgress = progress;
    }

    const btcX = startX + btcProgress * trackWidth;
    const ethX = startX + ethProgress * trackWidth;

    // Draw Finish Line
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(endX + 40, 0);
    ctx.lineTo(endX + 40, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw BTC
    drawVehicle(ctx, btcX, btcY + btcJitter, '#f59e0b', 'BTC', isRacing);
    // Draw ETH
    drawVehicle(ctx, ethX, ethY + ethJitter, '#3b82f6', 'ETH', isRacing);

    if (progress < 1 && isRacing) {
      requestRef.current = requestAnimationFrame(animate);
    } else if (isRacing) {
      onFinish();
    }
  };

  const drawVehicle = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string, active: boolean) => {
    // Glow
    ctx.shadowBlur = active ? 20 : 0;
    ctx.shadowColor = color;

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - 30, y - 15, 60, 30, 8);
    ctx.fill();

    // Cockpit
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.roundRect(x + 5, y - 10, 20, 20, 4);
    ctx.fill();

    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 5);

    // Thruster
    if (active) {
      const thrusterSize = 10 + Math.random() * 10;
      const thrusterGrad = ctx.createLinearGradient(x - 30, y, x - 30 - thrusterSize, y);
      thrusterGrad.addColorStop(0, color);
      thrusterGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = thrusterGrad;
      ctx.beginPath();
      ctx.moveTo(x - 30, y - 10);
      ctx.lineTo(x - 30 - thrusterSize, y);
      ctx.lineTo(x - 30, y + 10);
      ctx.fill();
    }
  };

  useEffect(() => {
    initParticles();
    if (isRacing) {
      startTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(animate);
    } else {
        // Draw initial state
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                drawVehicle(ctx, 50, canvas.height * 0.3, '#f59e0b', 'BTC', false);
                drawVehicle(ctx, 50, canvas.height * 0.7, '#3b82f6', 'ETH', false);
            }
        }
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRacing]);

  return (
    <div className="relative w-full aspect-[16/9] md:aspect-[2/1] bg-slate-900 rounded-xl md:rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={400} 
        className="w-full h-full object-cover"
      />
      
      {/* HUD Overlay */}
      <div className="absolute top-3 md:top-4 left-3 md:left-4 right-3 md:right-4 flex justify-between items-start">
        <div className="px-2 md:px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-[8px] md:text-[10px] font-mono text-white/70 uppercase tracking-widest">
          Live Telemetry
        </div>

        {totalWinnings > 0 && (
          <div className="bg-black/60 backdrop-blur-md border border-yellow-500/30 rounded-lg px-3 md:px-4 py-1.5 md:py-2 flex items-center gap-2 md:gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5 md:w-5 md:h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-[8px] md:text-[10px] uppercase tracking-wider text-yellow-500/70 font-bold leading-tight">Winnings</p>
              <p className="text-sm md:text-lg font-mono font-bold text-white leading-none">
                ${totalWinnings.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>

      {!isRacing && !winner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <div className="text-center px-4">
            <div className="text-2xl md:text-4xl font-black text-white italic tracking-tighter mb-1 md:mb-2">READY TO RACE?</div>
            <div className="text-white/50 text-[10px] md:text-sm uppercase tracking-widest">Place your bet to start</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasRace;
