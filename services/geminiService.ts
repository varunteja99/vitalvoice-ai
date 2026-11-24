import { HealthAnalysis, ChatMessage } from "../types";

export const analyzeHealth = async (
  audioBase64: string,
  audioMimeType: string = "audio/webm",
  imageBase64?: string,
  imageMimeType: string = "image/jpeg",
  language: string = "English (US)"
): Promise<HealthAnalysis> => {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audioBase64,
      audioMimeType,
      imageBase64,
      imageMimeType,
      language,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Analysis failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore JSON parse errors on error response
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as HealthAnalysis;
};

export const chatWithHealthAssistant = async (
  history: ChatMessage[],
  newMessage: string,
  analysisContext: HealthAnalysis,
  language: string = "English (US)",
  audioBase64?: string
): Promise<string> => {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        history,
        newMessage,
        analysisContext,
        language,
        audioBase64,
      }),
    });

    if (!response.ok) {
      let errorMessage = "I'm having trouble connecting to the VitalVoice servers right now. Please try again.";
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = `Unable to process request: ${errorData.error}`;
        }
      } catch {
        // Ignore JSON parse errors
      }
      return errorMessage;
    }

    const data = await response.json();
    return data.text || "I couldn't process that response.";
  } catch (error) {
    console.error("Chat error:", error);
    return "I'm having trouble connecting to the VitalVoice servers right now. Please try again.";
  }
};
