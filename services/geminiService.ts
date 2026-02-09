import { GoogleGenAI, Type } from "@google/genai";
import { BrandDNA, AssetType } from "../types";
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
  assetType: AssetType,
  dna: BrandDNA,
  theme?: string
): Promise<{ url: string, mediaType: 'image' | 'video' }> => {
  
  // Route to video generation if needed
  if (assetType === 'Vertical Video' || assetType === 'Horizontal Video') {
    const videoUrl = await generateBrandVideo(assetType, dna, theme);
    return { url: videoUrl, mediaType: 'video' };
  }

  const ai = getAIClient();

  let itemPrompt = "";
  let aspectRatio = "1:1";

  switch (assetType) {
    case 'T-Shirt':
      itemPrompt = "A high-quality cotton t-shirt presented flat-lay or on a ghost mannequin";
      break;
    case 'Cap':
      itemPrompt = "A structured baseball cap or dad hat with embroidery details";
      break;
    case 'Billboard':
      itemPrompt = "A massive outdoor billboard mockup in a busy city environment";
      aspectRatio = "4:3";
      break;
    case 'Poster':
      itemPrompt = "A sleek vertical poster framed in a modern subway station or gallery wall";
      aspectRatio = "3:4";
      break;
    case 'Mug':
      itemPrompt = "A ceramic coffee mug with a matte finish on a wooden table";
      break;
    case 'Tote':
      itemPrompt = "A natural canvas tote bag hanging on a hook or placed on a bench";
      break;
    case 'Influencer Post':
      itemPrompt = "A professional fashion influencer lifestyle shot wearing the brand merchandise or interacting with the product in a trendy urban setting";
      aspectRatio = "3:4";
      break;
    case 'Square Logo':
      itemPrompt = "A polished, high-resolution square logo presentation, suitable for social media profiles or app icons, centered on a neutral or brand-color background";
      aspectRatio = "1:1";
      break;
    default:
      itemPrompt = `A premium ${assetType} product mockup`;
  }

  const themeContext = theme ? `\nCONTEXTUAL THEME: The asset must be themed around "${theme}" (e.g. season, event, or mood) while strictly maintaining the core brand identity defined below.` : "";

  const prompt = `
    Create a photorealistic 4K product mockup for: ${itemPrompt}.
    ${themeContext}
    
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
        aspectRatio: aspectRatio
      }
    }
  });

  const parts = response.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData?.data) {
    throw new Error("No image generated");
  }

  return { 
    url: `data:image/png;base64,${imagePart.inlineData.data}`,
    mediaType: 'image'
  };
};

const generateBrandVideo = async (assetType: 'Vertical Video' | 'Horizontal Video', dna: BrandDNA, theme?: string): Promise<string> => {
  const ai = getAIClient();
  const isVertical = assetType === 'Vertical Video';
  
  const themeContext = theme ? `The video should featured a specific theme: "${theme}".` : "";

  const prompt = `
    Cinematic, high-energy ${isVertical ? 'vertical' : 'horizontal'} commercial video for a brand with style: ${dna.style}.
    ${themeContext}
    Key colors: ${dna.palette.join(", ")}.
    Visuals: Abstract motion graphics, flowing fabrics, or lifestyle scenes reflecting the brand keywords: ${dna.keywords.join(", ")}.
    The video should be sleek, modern, and loopable.
  `;

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '1080p',
      aspectRatio: isVertical ? '9:16' : '16:9'
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed to return a URI");

  // Fetch the video to create a blob URL (avoids exposing API key in DOM)
  const videoRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!videoRes.ok) throw new Error("Failed to download generated video");
  
  const blob = await videoRes.blob();
  return URL.createObjectURL(blob);
}

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