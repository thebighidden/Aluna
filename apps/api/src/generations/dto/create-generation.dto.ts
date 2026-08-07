import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { STYLES_CONFIG } from '../../generation/styles.config';

export class CreateGenerationDto {
  @IsString()
  @IsIn(Object.keys(STYLES_CONFIG))
  category!: string;

  @IsString()
  sceneId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  variants = 1;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brief?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  productType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  options?: string;

  /** Required when sceneId uses the "ai:" prefix. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  analysisId?: string;

  /** Attach this run to one of the user's campaigns. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  campaignId?: string;
}
