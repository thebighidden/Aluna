import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BRAND_PROFILE_LIMITS, BUSINESS_TYPES } from '../brand-profile.constants';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class UpdateBrandProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  brandName?: string;

  @IsOptional()
  @IsString()
  @IsIn(BUSINESS_TYPES)
  businessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(BRAND_PROFILE_LIMITS.shortText)
  businessSubcategory?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(300)
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(BRAND_PROFILE_LIMITS.description)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slogan?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  markets?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(12, { each: true })
  languages?: string[];

  @IsOptional()
  @IsObject()
  audience?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  positioning?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  values?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  tone?: string[];

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  primaryColor?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.colorItems)
  @Matches(HEX_COLOR, { each: true })
  secondaryColors?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.colorItems)
  @Matches(HEX_COLOR, { each: true })
  accentColors?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryFont?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  secondaryFont?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  photographyStyles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  preferredEnvironments?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  forbiddenEnvironments?: string[];

  @IsOptional()
  @IsObject()
  preferredModelAttributes?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  defaultChannels?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  defaultAspectRatios?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  defaultCampaignObjectives?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  forbiddenVisualElements?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BRAND_PROFILE_LIMITS.listItems)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  requiredVisualElements?: string[];

  @IsOptional()
  @IsBoolean()
  onboardingComplete?: boolean;
}
