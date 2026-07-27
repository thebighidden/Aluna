export const GENERATION_QUEUE = 'generation';

export interface GenerationJobData {
  generationId: string;
  inputKey: string;
  category: string;
  sceneId: string;
  variants: number;
}
