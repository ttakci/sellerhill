import { ApiProperty } from '@nestjs/swagger';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type GoogleAuthRequest,
  type SupportedLocale,
} from '@repo/shared';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto implements GoogleAuthRequest {
  @ApiProperty({
    description: 'GIS popup authorization code (auth-code flow)',
    example: '4/0AeanS...',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: 'User preferred locale from the FE',
    example: 'en',
    enum: SUPPORTED_LOCALES,
    required: false,
    default: DEFAULT_LOCALE,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LOCALES)
  locale?: SupportedLocale;
}
