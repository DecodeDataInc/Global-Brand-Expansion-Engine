
export interface BrandDNA {
  palette: string[];
  style: string;
  fonts: string;
  keywords: string[];
  description: string;
}

export type AssetType = 
  | 'T-Shirt' 
  | 'Cap' 
  | 'Billboard' 
  | 'Poster' 
  | 'Mug' 
  | 'Tote'
  | 'Vertical Video'
  | 'Horizontal Video'
  | 'Influencer Post'
  | 'Square Logo';

export type MediaType = 'image' | 'video';

export interface GeneratedAsset {
  id: string;
  category: AssetType;
  imageUrl: string; // Used for both image and video URLs
  mediaType: MediaType;
  history: string[]; // Stores previous URLs for undo
  prompt: string;
  timestamp: number;
}

export interface EditorState {
  isOpen: boolean;
  asset: GeneratedAsset | null;
}