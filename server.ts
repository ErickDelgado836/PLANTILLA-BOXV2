import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Lazy-load GoogleGenAI to prevent crashing on boot if key is missing helper-wise
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("La variable de entorno GEMINI_API_KEY es obligatoria");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// endpoint de salud
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// endpoint de corrección de ortografía en español
app.post("/api/spellcheck", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.json({ errors: [] });
  }

  try {
    const ai = getGemini();
    const prompt = `Actúa como un corrector ortográfico y gramatical profesional nativo de español de la Real Academia Española (RAE).
Analiza detenidamente el siguiente texto. Identifica errores ortográficos, de acentuación (tildes), puntuación o de coherencia/concordancia gramatical básica.
Para cada error que encuentres, reporta:
1. La palabra o grupo de palabras con error ("word").
2. De 1 a 3 sugerencias de corrección ("replacements").
3. Una breve explicación del error ("reason", ej: "Falta tilde diacrítica", "Error ortográfico: se escribe con b", "Problema de concordancia género/número").

Texto a corregir:
"""
${text}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres un servicio de corrección de ortografía rápido y preciso en español. Devuelves únicamente el JSON estructurado solicitado de forma impecable.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            errors: {
              type: Type.ARRAY,
              description: "Lista de errores ortográficos, gramaticales o de acentuación encontrados en el texto.",
              items: {
                type: Type.OBJECT,
                properties: {
                  word: {
                    type: Type.STRING,
                    description: "La palabra exacta con el error (tal cual aparece en el texto)."
                  },
                  replacements: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Opciones sugeridas ordenadas por relevancia."
                  },
                  reason: {
                    type: Type.STRING,
                    description: "Breve explicación en español del motivo del error o sugerencia."
                  }
                },
                required: ["word", "replacements", "reason"]
              }
            }
          },
          required: ["errors"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      return res.json({ errors: [] });
    }

    const parsed = JSON.parse(resultText);
    return res.json(parsed);
  } catch (error: any) {
    console.error("Error en spellcheck backend:", error);
    return res.status(500).json({
      error: "Ocurrió un error al procesar la revisión ortográfica.",
      details: error.message || error
    });
  }
});

// Configuración de Vite como Middleware de desarrollo
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PlantillaBox] Servidor escuchando en http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Error al arrancar el servidor Express:", err);
});
