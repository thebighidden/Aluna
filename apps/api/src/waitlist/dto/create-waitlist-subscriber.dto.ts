import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const normalizePhone = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;

  const compact = value.trim().replace(/[\s().-]/g, '');
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (/^0[5-7]\d{8}$/.test(compact)) return `+212${compact.slice(1)}`;
  return compact;
};

export class CreateWaitlistSubscriberDto {
  @Transform(({ value }: { value: unknown }) => normalizePhone(value))
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be a valid WhatsApp number with a country code',
  })
  @MaxLength(16)
  phone!: string;

  @IsOptional()
  @IsIn(['en', 'fr', 'ar'])
  locale?: 'en' | 'fr' | 'ar';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
