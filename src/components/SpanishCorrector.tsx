import React, { useState } from "react";
import { Sparkles, Check, RefreshCw, AlertCircle } from "lucide-react";
import { SpellingError } from "../types";

interface SpanishCorrectorProps {
  text: string;
  onApplyCorrection: (original: string, corrected: string) => void;
}

export default function SpanishCorrector({ text, onApplyCorrection }: SpanishCorrectorProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<SpellingError[]>([]);
  const [hasRun, setHasRun] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const checkSpelling = async () => {
    if (!text || text.trim().length === 0) {
      setMessage("Escribe algo en tu plantilla antes de revisar.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setErrors([]);
    try {
      const response = await fetch("/api/spellcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Error en el servidor de revisión");
      }

      const data = await response.json();
      if (data.errors && Array.isArray(data.errors)) {
        setErrors(data.errors);
        setHasRun(true);
        if (data.errors.length === 0) {
          setMessage("¡Excelente! No se encontraron errores ortográficos en español. ✨");
        }
      } else {
        setErrors([]);
        setMessage("No se pudieron extraer los resultados del texto.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Hubo un problema al conectar con el revisor de ortografía.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (original: string, corrected: string) => {
    onApplyCorrection(original, corrected);
    // Remove corrected error from the current visual list
    setErrors((prev) => prev.filter((err) => err.word !== original));
  };

  return (
    <div className="bg-slate-900/50 border border-teal-500/20 rounded-xl p-3 mb-3 text-slate-200 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-teal-400 animate-pulse" />
          <span className="text-xs font-semibold text-teal-300 uppercase tracking-widest">
            Corrector Ortográfico (Solo Español)
          </span>
        </div>
        <button
          onClick={checkSpelling}
          disabled={loading}
          className="btn !py-1 !px-3 !rounded-lg text-xs bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 hover:text-white border border-teal-500/20 focus:ring-1 focus:ring-teal-400/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              Revisando...
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Revisar Ortografía
            </>
          )}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 gap-2 text-xs text-teal-400 font-mono">
          <RefreshCw size={14} className="animate-spin" />
          <span>Auditando texto con la RAE...</span>
        </div>
      )}

      {!loading && message && (
        <p className="text-xs text-slate-400 mt-1 font-medium bg-slate-950/40 p-2 rounded-lg border border-white/5 flex items-center gap-1.5 animate-fadeIn">
          <Check size={14} className="text-teal-400 shrink-0" />
          {message}
        </p>
      )}

      {!loading && errors.length > 0 && (
        <div className="mt-2 space-y-2 animate-fadeIn">
          <p className="text-[11px] text-slate-400 mb-1 flex items-center gap-1 font-medium">
            <AlertCircle size={12} className="text-amber-400" />
            Haz clic en la palabra correcta para sustituirla automáticamente:
          </p>
          <div className="max-h-36 overflow-y-auto pr-1 space-y-1 scrollbar">
            {errors.map((err, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs p-2 bg-slate-950/70 border border-rose-500/10 rounded-lg hover:border-rose-500/20 transition-all gap-3"
              >
                <div className="shrink-1 min-w-0 pr-2">
                  <span className="text-rose-400 line-through font-mono font-semibold break-all mr-1.5">
                    {err.word}
                  </span>
                  <span className="text-slate-400 text-[11px] block sm:inline italic">
                    ({err.reason})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {err.replacements && err.replacements.length > 0 ? (
                    err.replacements.map((rep, j) => (
                      <button
                        key={j}
                        onClick={() => handleApply(err.word, rep)}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 px-2 py-0.5 rounded text-xs font-semibold hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md shadow-teal-500/5 hover:shadow-teal-500/10"
                      >
                        {rep}
                      </button>
                    ))
                  ) : (
                    <span className="text-[11px] text-gray-500 font-mono">Sin sugerencias</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
