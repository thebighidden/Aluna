import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateSiteVisitDto {
  @IsString()
  @MaxLength(300)
  @Matches(/^\/(?!\/)/, { message: 'path must be an application path' })
  path!: string;

  @IsUUID()
  visitorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;
}
