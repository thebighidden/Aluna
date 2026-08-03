export const GENERATION_QUEUE = 'generation';

export interface GenerationJobData {
  generationId: string;
  userId: string;
  inputKey: string;
  category: string;
  sceneId: string;
  variants: number;
  brief?: string;
  options: Record<string, string>;
}
