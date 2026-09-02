import { ApiProperty } from '@nestjs/swagger';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type ForgotPasswordRequest,
  type SupportedLocale,
} from '@repo/shared';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty({ description: 'Account email address', example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Preferred locale for the reset email and link',
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
