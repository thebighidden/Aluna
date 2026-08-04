import { IsIn, IsString } from 'class-validator';

export class UpdateGenerationProviderDto {
  @IsString()
  @IsIn(['cloudflare', 'gemini', 'openai'])
  provider!: 'cloudflare' | 'gemini' | 'openai';
}
