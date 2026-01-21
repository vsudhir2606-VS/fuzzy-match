
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  /**
   * Cleans a list of names using Gemini to normalize them by removing noisy text.
   */
  async cleanNames(names: string[]): Promise<string[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Normalize and clean the following business names. Remove legal entity suffixes (like Ltd, Co, Corp), standardizing spacing and capitalization. Keep only the core business name. Return as a JSON array of strings.\n\nNames: ${names.join(", ")}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Gemini Cleaning Error:", error);
      return names; // Fallback to raw names
    }
  }
};
