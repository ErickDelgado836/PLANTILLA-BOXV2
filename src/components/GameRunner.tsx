import React, { useEffect, useRef, useState } from "react";
import { X, Play, ShieldAlert } from "lucide-react";

interface GameRunnerProps {
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
}

export default function GameRunner({ onClose, zIndex, onFocus }: GameRunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem("plantillabox_hiscore") || "0");
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [deadType, setDeadType] = useState<string>("😵");

  // Draggable and Resizable state
  const [position, setPosition] = useState({ x: 120, y: 150 });
  const [size, setSize] = useState({ width: 440, height: 320 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 120, y: 150 });

  const [isResizing, setIsResizing] = useState(false);
  const resizeDir = useRef<string | null>(null);
  const startSize = useRef({ width: 440, height: 320 });
  const startPos = useRef({ x: 120, y: 150 });
  const startMouse = useRef({ x: 0, y: 0 });

  // Game internal refs to prevent stale closure loops
  const stateRef = useRef({
    score: 0,
    speed: 4.5,
    frame: 0,
    isPlaying: false,
    gameOver: false,
    camel: {
      x: 40,
      baseY: 110,
      y: 110,
      w: 22,
      h: 30,
      dy: 0,
      jumpPower: -11.5,
      g: 0.8,
      grounded: true,
      ducking: false,
    },
    obstacles: [] as Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      vx: number;
      emoji: string;
      type?: string;
      isSine?: boolean;
      baseY?: number;
      time?: number;
    }>,
    highScore: Number(localStorage.getItem("plantillabox_hiscore") || "0"),
  });

  useEffect(() => {
    // Keep high score state synced
    stateRef.current.highScore = highScore;
  }, [highScore]);

  // Center window on mount
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPosition({
      x: Math.max(10, (w - 440) / 2),
      y: Math.max(80, (h - 320) / 2),
    });
  }, []);

  // Keyboard Event registration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not play if typing in input lists or search
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        triggerJump();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        stateRef.current.camel.ducking = true;
        if (!stateRef.current.camel.grounded) {
          stateRef.current.camel.dy += 6; // quick fall
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") {
        stateRef.current.camel.ducking = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPlaying, gameOver]);

  // Game Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameTick = () => {
      if (!canvas || !ctx) return;
      const state = stateRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Ground
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.moveTo(0, 140);
      ctx.lineTo(canvas.width, 140);
      ctx.stroke();

      if (state.isPlaying && !state.gameOver) {
        // Dynamic Hitbox
        state.camel.h = state.camel.ducking ? 16 : 30;
        const targetY = state.camel.ducking ? state.camel.baseY + 14 : state.camel.baseY;

        state.camel.dy += state.camel.g;
        state.camel.y += state.camel.dy;

        // Ground collision
        if (state.camel.y >= targetY) {
          state.camel.y = targetY;
          state.camel.dy = 0;
          state.camel.grounded = true;
        } else {
          state.camel.grounded = false;
        }

        // Spawn obstacles
        const obstacleFrequency = Math.max(20, Math.floor(95 - state.speed * 6));
        if (state.frame % obstacleFrequency === 0) {
          const rand = Math.random();
          const obsBase = { x: canvas.width, vx: state.speed };

          if (rand < 0.28) {
            state.obstacles.push({ ...obsBase, y: 112, w: 18, h: 28, emoji: "🌵" });
          } else if (rand < 0.42) {
            state.obstacles.push({ ...obsBase, y: 125, w: 20, h: 15, emoji: "🦂" });
          } else if (rand < 0.55) {
            state.obstacles.push({ ...obsBase, y: 125, w: 20, h: 15, emoji: "💣", type: "boom" });
          } else if (rand < 0.70) {
            state.obstacles.push({ ...obsBase, y: 100, w: 22, h: 20, emoji: "🦅" });
          } else if (rand < 0.82) {
            state.obstacles.push({ ...obsBase, y: 120, w: 22, h: 18, emoji: "🦅" });
          } else if (rand < 0.92) {
            state.obstacles.push({ ...obsBase, y: 105, w: 24, h: 14, vx: state.speed * 1.4, emoji: "🚀", type: "boom" });
          } else {
            state.obstacles.push({ ...obsBase, y: 90, baseY: 90, w: 22, h: 16, vx: state.speed * 1.1, emoji: "🛸", isSine: true, time: 0 });
          }
        }

        // Move and Check collisions
        for (let i = 0; i < state.obstacles.length; i++) {
          const obs = state.obstacles[i];
          if (obs.isSine) {
            obs.time = (obs.time || 0) + 0.1;
            obs.y = (obs.baseY || 90) + Math.sin(obs.time) * 35;
          }
          obs.x -= obs.vx;

          const pX = 4;
          const pY = 4;
          if (
            state.camel.x + pX < obs.x + obs.w &&
            state.camel.x + state.camel.w - pX > obs.x &&
            state.camel.y + pY < obs.y + obs.h &&
            state.camel.y + state.camel.h - pY > obs.y
          ) {
            state.gameOver = true;
            const deadCause = obs.type === "boom" ? "💥" : "😵";
            setDeadType(deadCause);
            setGameOver(true);

            if (Math.floor(state.score) > state.highScore) {
              const newHi = Math.floor(state.score);
              setHighScore(newHi);
              localStorage.setItem("plantillabox_hiscore", String(newHi));
            }
          }
        }

        state.obstacles = state.obstacles.filter((o) => o.x + o.w > 0);
        state.score += 0.1;
        state.speed += 0.002;
        state.frame++;

        setScore(Math.floor(state.score));
      }

      // Draw Camel
      ctx.save();
      if (state.gameOver) {
        if (deadType === "💥") {
          ctx.font = "36px Arial";
          ctx.fillText("💥", state.camel.x - 8, state.camel.y + 28);
        } else {
          ctx.font = "30px Arial";
          ctx.fillText("😵", state.camel.x - 4, state.camel.y + 26);
        }
      } else if (state.camel.ducking) {
        ctx.translate(state.camel.x + 12, state.camel.y + 16);
        ctx.scale(1.1, 0.6);
        ctx.font = "30px Arial";
        ctx.fillText("🐫", -16, 10);
      } else {
        ctx.font = "30px Arial";
        ctx.fillText("🐫", state.camel.x - 4, state.camel.y + 26);
      }
      ctx.restore();

      // Draw Obstacles
      for (const obs of state.obstacles) {
        ctx.font = "24px Arial";
        ctx.fillText(obs.emoji, obs.x - 2, obs.y + 22);
      }

      // Game state UI overlay inside canvas
      if (state.gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f43f5e";
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(deadType === "💥" ? "¡EXPLOTASTE!" : "¡CAZADO!", canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = "#ffffff";
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillText("Pulsa Espacio o Clic para reintentar", canvas.width / 2, canvas.height / 2 + 18);
        ctx.textAlign = "left";
      } else if (!state.isPlaying) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#2dd4bf";
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Pulsa Espacio / Clic para Empezar", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
      }

      animationFrameId = requestAnimationFrame(gameTick);
    };

    animationFrameId = requestAnimationFrame(gameTick);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, gameOver, deadType]);

  const triggerJump = () => {
    const s = stateRef.current;
    if (!s.isPlaying || s.gameOver) {
      // restart
      s.score = 0;
      s.speed = 4.5;
      s.frame = 0;
      s.gameOver = false;
      s.obstacles = [];
      s.camel.y = s.camel.baseY;
      s.camel.dy = 0;
      s.camel.grounded = true;
      s.camel.ducking = false;
      s.isPlaying = true;

      setScore(0);
      setGameOver(false);
      setIsPlaying(true);
    } else if (s.camel.grounded && !s.camel.ducking) {
      s.camel.dy = s.camel.jumpPower;
      s.camel.grounded = false;
    }
  };

  // Drag handlers
  const handleHeaderMouseDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".calc-close")) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onFocus();
  };

  const handleHeaderMouseMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({
      x: initialPos.current.x + dx,
      y: initialPos.current.y + dy,
    });
  };

  const handleHeaderMouseUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // Resize handlers
  const handleResizeMouseDown = (dir: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeDir.current = dir;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...size };
    startPos.current = { ...position };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onFocus();
  };

  const handleResizeMouseMove = (e: React.PointerEvent) => {
    if (!isResizing || !resizeDir.current) return;
    const dx = e.clientX - startMouse.current.x;
    const dy = e.clientY - startMouse.current.y;

    let newW = startSize.current.width;
    let newH = startSize.current.height;
    let newX = startPos.current.x;
    let newY = startPos.current.y;

    const dir = resizeDir.current;
    if (dir.includes("e")) newW = startSize.current.width + dx;
    if (dir.includes("s")) newH = startSize.current.height + dy;
    if (dir.includes("w")) {
      newW = startSize.current.width - dx;
      newX = startPos.current.x + dx;
    }
    if (dir.includes("n")) {
      newH = startSize.current.height - dy;
      newY = startPos.current.y + dy;
    }

    if (newW >= 300) {
      setSize((prev) => ({ ...prev, width: newW }));
      setPosition((prev) => ({ ...prev, x: newX }));
    }
    if (newH >= 200) {
      setSize((prev) => ({ ...prev, height: newH }));
      setPosition((prev) => ({ ...prev, y: newY }));
    }
  };

  const handleResizeMouseUp = (e: React.PointerEvent) => {
    if (isResizing) {
      setIsResizing(false);
      resizeDir.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onFocus}
      className="calc-widget select-none flex flex-col bg-slate-950/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: zIndex,
      }}
    >
      {/* 8-Way Resizers */}
      <div className="resizer n cursor-ns-resize absolute top-0 left-0 right-0 h-2 z-20" onPointerDown={(e) => handleResizeMouseDown("n", e)} onPointerMove={handleResizeMouseMove} onPointerUp={handleResizeMouseUp} />
      <div className="resizer s cursor-ns-resize absolute bottom-0 left-0 right-0 h-2 z-20" onPointerDown={(e) => handleResizeMouseDown("s", e)} onPointerMove={handleResizeMouseMove} onPointerUp={handleResizeMouseUp} />
      <div className="resizer e cursor-ew-resize absolute top-0 bottom-0 right-0 w-2 z-20" onPointerDown={(e) => handleResizeMouseDown("e", e)} onPointerMove={handleResizeMouseMove} onPointerUp={handleResizeMouseUp} />
      <div className="resizer w cursor-ew-resize absolute top-0 bottom-0 left-0 w-2 z-20" onPointerDown={(e) => handleResizeMouseDown("w", e)} onPointerMove={handleResizeMouseMove} onPointerUp={handleResizeMouseUp} />
      
      <div className="resizer ne cursor-nesw-resize absolute top-0 right-0 w-3 h-3 z-30" onPointerDown={(e) => handleResizeMouseDown("ne", e)} onPointerMove={handleResizeMouseMove} onPointerUp={handleResizeMouseUp} />
      <div className="resizer nw cursor-nwse-resize absolute top-0 left-0 w-3 h-3 z-30" onPointerDown={(e) => handleResizeMouseDown("nw", e)} onPointerMove={handleResizeMouseMove} onPointerUp={handleResizeMouseUp} />
      <div className="resizer se cursor-nwse-resize absolute bottom-0 right-0 w-3 h-3 z-30" onPointerDown={(e) => handleResizeMouseDown("se", e)} onPointerMove={handleResizeMouseMove} onPointerUp={handleResizeMouseUp} />
      <div className="resizer sw cursor-nesw-resize absolute bottom-0 left-0 w-3 h-3 z-30" onPointerDown={(e) => handleResizeMouseDown("sw", e)} onPointerMove={handleResizeMouseMove} onPointerUp={handleResizeMouseUp} />

      {/* Header */}
      <div
        className="calc-header bg-slate-900/90 text-sm font-semibold text-slate-400 px-4 py-3 flex justify-between items-center select-none active:cursor-grabbing border-b border-white/[0.05]"
        onPointerDown={handleHeaderMouseDown}
        onPointerMove={handleHeaderMouseMove}
        onPointerUp={handleHeaderMouseUp}
      >
        <span className="flex items-center gap-2 text-teal-400">
          <span>🎮</span> Runner Box (Camel Run)
        </span>
        <button
          onClick={onClose}
          className="calc-close w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 hover:text-rose-400 transition-all pointer-events-auto cursor-pointer text-rose-500 font-bold"
        >
          <X size={15} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 bg-slate-950 flex flex-col items-center justify-between overflow-hidden min-h-0">
        <div className="flex justify-between w-full font-mono text-teal-400 text-sm font-bold flex-shrink-0">
          <span>SCORE: <span className="text-white">{score}</span></span>
          <span className="text-yellow-400">HI-SCORE: <span className="text-white">{highScore}</span></span>
        </div>

        {/* Canvas container with auto-scaling layout */}
        <div className="flex-1 w-full my-2 flex items-center justify-center overflow-hidden min-h-0">
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
            onClick={triggerJump}
            className="bg-zinc-950 border border-white/5 rounded-xl cursor-pointer aspect-[8/3] max-w-full max-h-full object-contain"
          />
        </div>

        <div className="text-[11px] text-slate-500 flex justify-between w-full border-t border-white/5 pt-2 flex-shrink-0">
          <span>⌨️ Clic / Espacio: Saltar</span>
          <span>⬇️ Abajo: Agacharse / Caída rápida</span>
        </div>
      </div>
    </div>
  );
}
