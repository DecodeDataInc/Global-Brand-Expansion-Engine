export interface BrandDNA {
  palette: string[];
  style: string;
  fonts: string;
  keywords: string[];
  description: string;
}

export interface GeneratedAsset {
  id: string;
  category: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
}

export type AssetType = 'T-Shirt' | 'Cap' | 'Billboard' | 'Poster' | 'Mug' | 'Tote';

export interface EditorState {
  isOpen: boolean;
  asset: GeneratedAsset | null;
}