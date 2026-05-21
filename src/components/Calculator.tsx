import React, { useState, useRef, useEffect } from "react";
import { X, Copy, Check } from "lucide-react";

interface CalculatorProps {
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
}

export default function Calculator({ onClose, zIndex, onFocus }: CalculatorProps) {
  const [expr, setExpr] = useState<string>("");
  const [displayValue, setDisplayValue] = useState<string>("0");
  const [copied, setCopied] = useState<boolean>(false);
  const [justEvaluated, setJustEvaluated] = useState<boolean>(false);

  // Position and Size states
  const [position, setPosition] = useState({ x: 160, y: 160 });
  const [size, setSize] = useState({ width: 330, height: 420 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 160, y: 160 });

  const [isResizing, setIsResizing] = useState(false);
  const resizeDir = useRef<string | null>(null);
  const startSize = useRef({ width: 330, height: 420 });
  const startPos = useRef({ x: 160, y: 160 });
  const startMouse = useRef({ x: 0, y: 0 });

  // Center window on mount
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPosition({
      x: Math.max(10, (w - 330) / 2 - 40),
      y: Math.max(80, (h - 425) / 2 + 40),
    });
  }, []);

  // Format expression for standard displaying
  const formatExpression = (exp: string) => {
    if (!exp) return "0";
    return exp
      .replace(/\d+(\.\d*)?/g, (match) => {
        const parts = match.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.length > 1 ? parts[0] + "," + parts[1] : parts[0];
      })
      .replace(/\*/g, "×")
      .replace(/\//g, "÷");
  };

  const processInput = (val: string) => {
    const operators = ["+", "-", "*", "/", "^", "%"];
    const isOperator = operators.includes(val);

    if (val === "C" || val === "Escape" || val === "Delete") {
      setExpr("");
      setDisplayValue("0");
      setJustEvaluated(false);
    } else if (val === "Backspace") {
      setJustEvaluated(false);
      let updated = expr;
      if (expr.length > 0) {
        const tokens = ["sin(", "cos(", "tan(", "log(", "ln(", "√("];
        let deleted = false;
        for (const t of tokens) {
          if (expr.endsWith(t)) {
            updated = expr.slice(0, -t.length);
            deleted = true;
            break;
          }
        }
        if (!deleted) updated = expr.slice(0, -1);
      }
      setExpr(updated);
      setDisplayValue(updated ? formatExpression(updated) : "0");
    } else if (val === "=") {
      if (!expr) return;
      try {
        const evalStr = expr
          .replace(/π/g, "Math.PI")
          .replace(/e/g, "Math.E")
          .replace(/sin\(/g, "Math.sin(")
          .replace(/cos\(/g, "Math.cos(")
          .replace(/tan\(/g, "Math.tan(")
          .replace(/log\(/g, "Math.log10(")
          .replace(/ln\(/g, "Math.log(")
          .replace(/√\(/g, "Math.sqrt(")
          .replace(/\^/g, "**")
          .replace(/%/g, "/100");

        // evaluate safely
        const result = new Function("return " + evalStr)();
        if (result === undefined || isNaN(result) || !isFinite(result)) {
          throw new Error("Invalid");
        }

        const cleanResult = Number.isInteger(result) ? result : parseFloat(result.toFixed(10));
        const finalStr = String(cleanResult);
        setExpr(finalStr);
        setDisplayValue(formatExpression(finalStr));
        setJustEvaluated(true);
      } catch (e) {
        setDisplayValue("Error");
        setExpr("");
        setJustEvaluated(true);
      }
    } else {
      let currentExpr = expr;
      if (justEvaluated) {
        if (isOperator) {
          setJustEvaluated(false);
        } else {
          currentExpr = "";
          setJustEvaluated(false);
        }
      }

      if (currentExpr.length < 50) {
        if (val === ".") {
          const match = currentExpr.match(/\d+(\.\d*)?$/);
          if (match && match[0].includes(".")) return;
        }

        if (isOperator) {
          if (currentExpr.length === 0 && val !== "-") return;
          const lastChar = currentExpr.slice(-1);
          if (operators.includes(lastChar)) {
            currentExpr = currentExpr.slice(0, -1) + val;
            setExpr(currentExpr);
            setDisplayValue(formatExpression(currentExpr));
            return;
          }
        }

        const updated = currentExpr + val;
        setExpr(updated);
        setDisplayValue(formatExpression(updated));
      }
    }
  };

  const handleCopy = async () => {
    if (displayValue && displayValue !== "Error" && displayValue !== "0") {
      try {
        await navigator.clipboard.writeText(displayValue.replace(/\./g, "").replace(/,/g, "."));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (e) {
        console.error("Copy failed", e);
      }
    }
  };

  // Keyboard listening
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting if writing in inputs
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA")
      ) {
        return;
      }

      const allowedKeys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "+", "-", "*", "/", "(", ")", "%", "^"];
      if (allowedKeys.includes(e.key)) {
        e.preventDefault();
        processInput(e.key);
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        processInput("=");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        processInput("Backspace");
      } else if (e.key === "Delete" || e.key.toLowerCase() === "c" || e.key === "Escape") {
        e.preventDefault();
        processInput("C");
      } else {
        const map: Record<string, string> = {
          s: "sin(",
          c: "cos(",
          t: "tan(",
          l: "log(",
          p: "π",
          e: "e",
          r: "√(",
        };
        const mapped = map[e.key.toLowerCase()];
        if (mapped) {
          e.preventDefault();
          processInput(mapped);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expr, justEvaluated]);

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

    if (newW >= 200) {
      setSize((prev) => ({ ...prev, width: newW }));
      setPosition((prev) => ({ ...prev, x: newX }));
    }
    if (newH >= 250) {
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

  const buttons = [
    { label: "sin", value: "sin(", type: "sci" },
    { label: "cos", value: "cos(", type: "sci" },
    { label: "tan", value: "tan(", type: "sci" },
    { label: "C", value: "C", type: "dang" },
    { label: "⌫", value: "Backspace", type: "dang" },

    { label: "log", value: "log(", type: "sci" },
    { label: "ln", value: "ln(", type: "sci" },
    { label: "√", value: "√(", type: "sci" },
    { label: "^", value: "^", type: "sci" },
    { label: "/", value: "/", type: "op" },

    { label: "π", value: "π", type: "sci" },
    { label: "7", value: "7", type: "num" },
    { label: "8", value: "8", type: "num" },
    { label: "9", value: "9", type: "num" },
    { label: "*", value: "*", type: "op" },

    { label: "e", value: "e", type: "sci" },
    { label: "4", value: "4", type: "num" },
    { label: "5", value: "5", type: "num" },
    { label: "6", value: "6", type: "num" },
    { label: "-", value: "-", type: "op" },

    { label: "%", value: "%", type: "sci" },
    { label: "1", value: "1", type: "num" },
    { label: "2", value: "2", type: "num" },
    { label: "3", value: "3", type: "num" },
    { label: "+", value: "+", type: "op" },

    { label: "(", value: "(", type: "op" },
    { label: ")", value: ")", type: "op" },
    { label: "0", value: "0", type: "num" },
    { label: ".", value: ".", type: "num" },
    { label: "=", value: "=", type: "eq" },
  ];

  return (
    <div
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
        <span className="flex items-center gap-2">
          <span>🧮</span> Matemática Científica
        </span>
        <button
          onClick={onClose}
          className="calc-close w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 hover:text-rose-400 transition-all pointer-events-auto cursor-pointer text-rose-500 font-bold"
        >
          <X size={15} />
        </button>
      </div>

      {/* Calculator Display */}
      <div className="relative flex-shrink-0 bg-black/40 border-b border-white/5">
        <input
          type="text"
          readOnly
          className="w-full bg-transparent text-white font-mono text-right text-3xl px-6 py-5 outline-none select-all overflow-x-auto tracking-wide scrollbar"
          value={displayValue}
        />
        <button
          onClick={handleCopy}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-neutral-800 rounded-lg text-slate-400 hover:text-teal-400 transition-all cursor-pointer flex items-center justify-center border border-white/5 bg-slate-950/50"
          title="Copiar resultado"
        >
          {copied ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
        </button>
      </div>

      {/* Buttons Grid */}
      <div className="flex-1 min-h-0 bg-slate-950/60 p-2 grid grid-cols-5 gap-1 shadow-inner">
        {buttons.map((btn, idx) => {
          let btnClass = "text-sm text-slate-200 hover:bg-white/[0.08] active:scale-95 transition-all rounded-lg flex items-center justify-center font-medium cursor-pointer";
          if (btn.type === "sci") {
            btnClass = "text-xs text-indigo-400 bg-indigo-950/25 hover:bg-indigo-950/45 active:scale-95 transition-all rounded-lg flex items-center justify-center font-medium cursor-pointer border border-indigo-900/10";
          } else if (btn.type === "op") {
            btnClass = "text-sm text-teal-400 bg-teal-950/20 hover:bg-teal-950/40 active:scale-95 transition-all rounded-lg flex items-center justify-center font-semibold cursor-pointer border border-teal-900/10";
          } else if (btn.type === "dang") {
            btnClass = "text-sm text-rose-400 bg-rose-950/20 hover:bg-rose-950/40 active:scale-95 transition-all rounded-lg flex items-center justify-center font-bold cursor-pointer border border-rose-900/10";
          } else if (btn.type === "eq") {
            btnClass = "text-lg text-slate-950 bg-teal-400 hover:bg-teal-300 font-bold active:scale-95 transition-all rounded-lg flex items-center justify-center cursor-pointer shadow-lg shadow-teal-500/10";
          }
          return (
            <button
              key={idx}
              onClick={() => processInput(btn.value)}
              className={btnClass}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
