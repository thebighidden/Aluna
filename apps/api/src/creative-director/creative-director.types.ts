import type { CampaignOptions } from '../generation/campaign-options.config';
import type { ProductCategory } from '../generation/styles.config';
import type { ProductAnalysisResult } from '../product-analysis/product-analysis.types';

export interface CreativeDirectorInput {
  userId: string;
  generationId: string;
  category: ProductCategory;
  sceneId: string;
  variants: number;
  productType?: string;
  brief?: string;
  options: CampaignOptions;
  analysis?: ProductAnalysisResult | null;
}

export interface ProductContext {
  productType: string;
  productClass: string;
  businessType: string;
  confidence: number;
  rationale: string[];
  allowedEnvironments: string[];
  forbiddenEnvironments: string[];
  safetyBoundaries: string[];
}

export interface CampaignDna {
  objective: string;
  mood: string;
  palette: string[];
  environment: string;
  lighting: string;
  cameraLanguage: string;
  composition: string;
  audience: Record<string, unknown>;
  uniquenessIndex: number;
}

export interface CreativeShotPlan {
  index: number;
  role: 'hero' | 'lifestyle' | 'detail' | 'editorial';
  moment: string;
  composition: string;
  camera: string;
  lighting: string;
  environment: string;
}

export interface CreativePlan {
  version: 1;
  effectiveCategory: ProductCategory;
  effectiveSceneId: string;
  brandProfileVersion: number | null;
  brandSnapshot: Record<string, unknown> | null;
  productContext: ProductContext;
  campaignDna: CampaignDna;
  shots: CreativeShotPlan[];
  fingerprint: string;
  warnings: string[];
  prompt: string;
  /** Set when an AI-authored scene was chosen; replaces the hand-written preset template. */
  scenePrompt: string | null;
  analysisId: string | null;
}
