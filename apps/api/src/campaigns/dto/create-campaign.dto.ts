import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { STYLES_CONFIG } from '../../generation/styles.config';

export class CreateCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsIn(Object.keys(STYLES_CONFIG))
  category!: string;

  @IsString()
  @MaxLength(64)
  sceneId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  productType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brief?: string;

  /** JSON-encoded creative options object, same shape the generation endpoint accepts. */
  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  options?: string;
}
