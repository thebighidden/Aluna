import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateKeptAssetsDto {
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  keptOutputKeys!: string[];
}
