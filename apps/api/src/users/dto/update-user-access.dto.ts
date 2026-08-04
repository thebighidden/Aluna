import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateUserAccessDto {
  @IsOptional()
  @IsISO8601()
  bannedUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  banReason?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  requestLimitPerHour?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  requestLimitPerDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  maxVariantsPerRequest?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxConcurrentRequests?: number;
}
