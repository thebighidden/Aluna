import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BroadcastNotificationDto {
  /** Empty or omitted targets every active user. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  userIds?: string[];

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;

  @IsIn(['in_app', 'email', 'both'])
  channel!: 'in_app' | 'email' | 'both';
}

export class ComposeWaitlistMessageDto {
  @IsString()
  @MaxLength(64)
  template!: string;
}
