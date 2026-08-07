import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWaitlistSubscriberDto {
  @IsOptional()
  @IsIn(['new', 'contacted', 'invited', 'converted', 'archived'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
