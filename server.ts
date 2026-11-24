import express, { type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANALYSIS_MODEL = "gemini-4-hydrogen";

const SYSTEM_INSTRUCTION_ANALYSIS = `
You are a health screening AI analyzing voice biomarkers. 
Based on observations, assess risk levels for Neurological health, Mental health, Respiratory health, Cardiovascular, Metabolic, and Hydration.
Provide confidence levels. Be encouraging but honest. This is screening, not diagnosis.
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overall_wellness_score: { type: Type.NUMBER, description: "0-100 score" },
    confidence_level: { type: Type.STRING, enum: ["low", "medium", "high"] },
    domain_scores: {
      type: Type.OBJECT,
      properties: {
        neurological: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            concern_level: { type: Type.STRING, enum: ["low", "moderate", "elevated", "high"] },
            indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING }
          }
        },
        mental_health: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            concern_level: { type: Type.STRING, enum: ["low", "moderate", "elevated", "high"] },
            indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING }
          }
        },
        respiratory: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            concern_level: { type: Type.STRING, enum: ["low", "moderate", "elevated", "high"] },
            indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING }
          }
        },
        cardiovascular: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            concern_level: { type: Type.STRING, enum: ["low", "moderate", "elevated", "high"] },
            indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING }
          }
        },
        metabolic: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            concern_level: { type: Type.STRING, enum: ["low", "moderate", "elevated", "high"] },
            indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING }
          }
        },
        hydration: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            concern_level: { type: Type.STRING, enum: ["low", "moderate", "elevated", "high"] },
            indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING }
          }
        }
      }
    },
    key_observations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          finding: { type: Type.STRING },
          significance: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ["low", "medium", "high"] }
        }
      }
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          urgency: { type: Type.STRING, enum: ["routine", "soon", "prompt"] },
          reason: { type: Type.STRING }
        }
      }
    },
    trends: {
      type: Type.OBJECT,
      properties: {
        improving: { type: Type.ARRAY, items: { type: Type.STRING } },
        stable: { type: Type.ARRAY, items: { type: Type.STRING } },
        needs_attention: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    summary: { type: Type.STRING },
    disclaimer: { type: Type.STRING }
  }
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Increase payload limit to support base64-encoded audio and image uploads
  app.use(express.json({ limit: "50mb" }));

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // POST /api/analyze - Multimodal voice and facial biomarker screening
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const {
        audioBase64,
        audioMimeType = "audio/webm",
        imageBase64,
        imageMimeType = "image/jpeg",
        language = "English (US)",
      } = req.body ?? {};

      if (!audioBase64 || typeof audioBase64 !== "string") {
        res.status(400).json({ error: "Missing or invalid audioBase64 payload." });
        return;
      }

      const ai = getAiClient();

      const parts: Array<Record<string, unknown>> = [
        {
          text: `Analyze the provided audio ${imageBase64 ? "and facial image" : ""} to screen for health biomarkers.
        If this is an uploaded dataset file, treat it as a clinical sample for validation.

        CRITICAL INSTRUCTION: The user is speaking in ${language}. 
        You MUST perform the analysis understanding this language.
        All textual output in the JSON (summaries, explanations, findings, recommendations, disclaimers) MUST be translated into and written in ${language}.
        
        1. VOCAL CHARACTERISTICS:
        - Pitch, Volume, Tremor, Breathiness
        
        2. SPEECH PATTERNS:
        - Rate, Pauses, Rhythm, Articulation
        
        3. EMOTIONAL INDICATORS:
        - Energy, Engagement, Stress

        ${
          imageBase64
            ? `
        4. FACE ANALYSIS (if provided):
        - Skin color/tone (pallor, yellowing)
        - Eye appearance (sunken, drooping)
        - Hydration signs
        - Facial symmetry
        
        CORRELATE findings across both modalities.`
            : ""
        }

        Output strict JSON based on the schema.`,
        },
        {
          inlineData: {
            mimeType: typeof audioMimeType === "string" && audioMimeType ? audioMimeType : "audio/webm",
            data: audioBase64,
          },
        },
      ];

      if (imageBase64 && typeof imageBase64 === "string") {
        parts.push({
          inlineData: {
            mimeType: typeof imageMimeType === "string" && imageMimeType ? imageMimeType : "image/jpeg",
            data: imageBase64,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: ANALYSIS_MODEL,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_ANALYSIS,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response received from Gemini model.");
      }

      const parsed = JSON.parse(responseText);
      res.json(parsed);
    } catch (error: unknown) {
      console.error("Server /api/analyze error:", error);
      const message = error instanceof Error ? error.message : "Failed to analyze health data.";
      res.status(500).json({ error: message });
    }
  });

  // POST /api/chat - Contextual health screening assistant chat
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const {
        history = [],
        newMessage = "",
        analysisContext,
        language = "English (US)",
        audioBase64,
      } = req.body ?? {};

      if (!analysisContext || typeof analysisContext !== "object") {
        res.status(400).json({ error: "Missing analysisContext for chat." });
        return;
      }

      const ai = getAiClient();
      const contextString = JSON.stringify(analysisContext);

      const systemPrompt = `You are VitalVoice AI, a specific-purpose health screening assistant.
    You are NOT a general purpose AI. You can ONLY discuss the user's specific health screening results.
    
    CONTEXT:
    The user completed a screening with these results: ${contextString}.

    STRICT RULES:
    1. SCOPE: If the user asks about coding, creative writing, history, or anything unrelated to THEIR health results, politely REFUSE. Say: "I can only answer questions about your screening results."
    2. LANGUAGE: The user speaks ${language}. Reply in ${language}.
    3. LENGTH: Keep responses CONCISE (max 100 words). Do not write essays.
    4. FORMAT: Use Markdown (bold, bullets) and Emojis (🍎, 🧠) for readability.
    5. SAFETY: Never provide a medical diagnosis. Frame everything as "screening indicators" or "biomarkers".
    `;

      const textHistory = Array.isArray(history)
        ? history
            .filter((h: Record<string, unknown>) => h && !h.isAudio && typeof h.text === "string")
            .map((h: Record<string, unknown>) => ({
              role: h.role === "model" ? "model" : "user",
              parts: [{ text: String(h.text) }],
            }))
        : [];

      const chat = ai.chats.create({
        model: ANALYSIS_MODEL,
        config: {
          systemInstruction: systemPrompt,
        },
        history: textHistory,
      });

      let messageContent: unknown;
      if (audioBase64 && typeof audioBase64 === "string") {
        messageContent = [
          { text: (typeof newMessage === "string" && newMessage) || "Please analyze this audio message." },
          { inlineData: { mimeType: "audio/webm", data: audioBase64 } },
        ];
      } else {
        messageContent = typeof newMessage === "string" ? newMessage : "";
      }

      const result = await chat.sendMessage({ message: messageContent as string });
      res.json({ text: result.text || "I couldn't process that response." });
    } catch (error: unknown) {
      console.error("Server /api/chat error:", error);
      const message = error instanceof Error ? error.message : "Failed to process chat message.";
      res.status(500).json({ error: message });
    }
  });

  const distPath = path.join(__dirname, "dist");
  const hasBuiltClient = fs.existsSync(path.join(distPath, "index.html"));
  const isDev =
    process.env.NODE_ENV !== "production" &&
    !process.env.K_SERVICE &&
    (process.env.npm_lifecycle_event === "dev" || !hasBuiltClient);

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("/{*splat}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VitalVoice AI server running on http://0.0.0.0:${PORT} (mode: ${isDev ? "development" : "production"})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
