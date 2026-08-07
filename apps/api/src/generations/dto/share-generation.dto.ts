import { IsBoolean } from 'class-validator';

export class ShareGenerationDto {
  @IsBoolean()
  shared!: boolean;
}
