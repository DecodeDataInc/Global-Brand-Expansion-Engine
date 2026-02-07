import { GoogleGenAI, Type } from "@google/genai";
import { BrandDNA } from "../types";
import { stripBase64Prefix } from "../utils";

// Helper to ensure we get a fresh instance with the selected key
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please select a key.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeBrandDNA = async (base64Image: string): Promise<BrandDNA> => {
  const ai = getAIClient();
  const cleanBase64 = stripBase64Prefix(base64Image);

  const prompt = `
    Analyze this brand asset image deeply. 
    Extract the 'Brand DNA' in a structured format.
    I need:
    1. A color palette (hex codes).
    2. A description of the visual style (e.g., 'Minimalist', 'Grunge', 'Luxury').
    3. Approximate font styles detected (e.g., 'Sans-serif bold', 'Script').
    4. Key visual keywords.
    5. A concise description of the logo/graphic for reproduction.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          palette: { type: Type.ARRAY, items: { type: Type.STRING } },
          style: { type: Type.STRING },
          fonts: { type: Type.STRING },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          description: { type: Type.STRING }
        }
      }
    }
  });

  if (!response.text) throw new Error("Failed to analyze brand DNA");
  return JSON.parse(response.text) as BrandDNA;
};

export const generateBrandAsset = async (
  assetType: string,
  dna: BrandDNA
): Promise<string> => {
  const ai = getAIClient();

  let itemPrompt = "";
  switch (assetType) {
    case 'T-Shirt':
      itemPrompt = "A high-quality cotton t-shirt presented flat-lay or on a ghost mannequin";
      break;
    case 'Cap':
      itemPrompt = "A structured baseball cap or dad hat with embroidery details";
      break;
    case 'Billboard':
      itemPrompt = "A massive outdoor billboard mockup in a busy city environment";
      break;
    case 'Poster':
      itemPrompt = "A sleek vertical poster framed in a modern subway station or gallery wall";
      break;
    case 'Mug':
      itemPrompt = "A ceramic coffee mug with a matte finish on a wooden table";
      break;
    case 'Tote':
      itemPrompt = "A natural canvas tote bag hanging on a hook or placed on a bench";
      break;
    default:
      itemPrompt = `A premium ${assetType} product mockup`;
  }

  const prompt = `
    Create a photorealistic 4K product mockup for: ${itemPrompt}.
    
    Apply this Brand DNA exactly:
    - Logo/Graphic Source: ${dna.description}
    - Primary Colors: ${dna.palette.join(", ")}
    - Visual Style: ${dna.style}
    - Mood: Professional, commercial photography, studio lighting, depth of field.
    
    Ensure the branding is clearly visible, correctly perspective-warped, and integrated naturally onto the physical material (fabric texture, paper grain, ceramic gloss).
  `;

  // Nano Banana Pro equivalent
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview', 
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        imageSize: '4K',
        aspectRatio: '1:1' 
      }
    }
  });

  const parts = response.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData?.data) {
    throw new Error("No image generated");
  }

  return `data:image/png;base64,${imagePart.inlineData.data}`;
};

export const refineAsset = async (
  originalImageUrl: string,
  maskImageUrl: string,
  instruction: string
): Promise<string> => {
  const ai = getAIClient();
  const originalBase64 = stripBase64Prefix(originalImageUrl);
  const maskBase64 = stripBase64Prefix(maskImageUrl);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        { text: instruction },
        { inlineData: { mimeType: 'image/png', data: originalBase64 } },
        { inlineData: { mimeType: 'image/png', data: maskBase64 } } 
      ]
    },
    config: {
        imageConfig: {
            imageSize: '4K',
        }
    }
  });

  const parts = response.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData?.data) {
    throw new Error("Failed to refine image");
  }

  return `data:image/png;base64,${imagePart.inlineData.data}`;
};