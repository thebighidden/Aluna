import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { STYLES_CONFIG } from '../../generation/styles.config';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.keys(STYLES_CONFIG))
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sceneId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  productType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brief?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  options?: string;
}
