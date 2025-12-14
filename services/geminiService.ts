import { GoogleGenAI, Type } from "@google/genai";
import { HealthAnalysis, ChatMessage } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_MODEL = "gemini-2.5-flash";

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
        },
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

export const analyzeHealth = async (
  audioBase64: string,
  audioMimeType: string = "audio/webm",
  imageBase64?: string,
  imageMimeType: string = "image/jpeg",
  language: string = "English (US)"
): Promise<HealthAnalysis> => {
  try {
    const parts: any[] = [
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

        ${imageBase64 ? `
        4. FACE ANALYSIS (if provided):
        - Skin color/tone (pallor, yellowing)
        - Eye appearance (sunken, drooping)
        - Hydration signs
        - Facial symmetry
        
        CORRELATE findings across both modalities.` : ""}

        Output strict JSON based on the schema.`
      },
      {
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64
        }
      }
    ];

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_ANALYSIS,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    if (!response.text) throw new Error("No response from AI");
    
    return JSON.parse(response.text) as HealthAnalysis;

  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

export const chatWithHealthAssistant = async (
  history: ChatMessage[],
  newMessage: string,
  analysisContext: HealthAnalysis,
  language: string = "English (US)",
  audioBase64?: string
): Promise<string> => {
  try {
    const contextString = JSON.stringify(analysisContext);
    // GUARDRAILS INJECTED INTO SYSTEM PROMPT
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

    // Filter history to text-only for now to avoid token overhead/complexity with re-sending audio blobs
    // In a production app, we would cache content or use session ID.
    const textHistory = history
      .filter(h => !h.isAudio) 
      .map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));

    const chat = ai.chats.create({
        model: ANALYSIS_MODEL,
        config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 350, // COST CONTROL: Limit response size
            temperature: 0.7,
        },
        history: textHistory
    });

    let messageContent: any;
    if (audioBase64) {
        messageContent = [
            { text: newMessage || "Please analyze this audio message." },
            { inlineData: { mimeType: 'audio/webm', data: audioBase64 } }
        ];
    } else {
        messageContent = newMessage;
    }

    const result = await chat.sendMessage({ message: messageContent });
    return result.text || "I couldn't process that response.";
  } catch (error) {
    console.error("Chat error:", error);
    return "I'm having trouble connecting to the VitalVoice servers right now. Please try again.";
  }
};
