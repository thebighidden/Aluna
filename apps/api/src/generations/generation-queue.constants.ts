export const GENERATION_QUEUE = 'generation';

export interface GenerationJobData {
  generationId: string;
  userId: string;
  inputKey: string;
  category: string;
  sceneId: string;
  variants: number;
  brief?: string;
  productType?: string;
  options: Record<string, string>;
  creativePlan: import('../creative-director/creative-director.types').CreativePlan;
}
