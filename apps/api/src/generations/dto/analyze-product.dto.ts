import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzeProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  productType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brief?: string;
}
