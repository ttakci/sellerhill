import { ApiProperty } from '@nestjs/swagger';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@repo/shared';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'User preferred locale/language for the email',
    example: 'en',
    enum: SUPPORTED_LOCALES as unknown as string[],
    required: false,
    default: DEFAULT_LOCALE,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LOCALES as unknown as string[])
  locale?: SupportedLocale;
}
