import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { STYLES_CONFIG } from '../../generation/styles.config';

export class PreviewCreativePlanDto {
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
  @MaxLength(160)
  productType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brief?: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, string>;

  /** Required when sceneId uses the "ai:" prefix. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  analysisId?: string;
}
