import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProviderCredentialsDto {
  @IsIn(['cloudflare', 'gemini', 'openai'])
  provider!: 'cloudflare' | 'gemini' | 'openai';

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  apiKey!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  accountId?: string;
}
