import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateGenerationModelDto {
  @IsIn(['cloudflare', 'gemini', 'openai'])
  provider!: 'cloudflare' | 'gemini' | 'openai';

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  model!: string;
}
