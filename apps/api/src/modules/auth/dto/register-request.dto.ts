import { ApiProperty } from '@nestjs/swagger';
import {
  AUTH_CONSTANTS,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type RegisterRequest,
  type SupportedLocale,
} from '@repo/shared';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterRequestDto implements RegisterRequest {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: AUTH_CONSTANTS.FIRST_NAME_MIN_LENGTH,
    maxLength: AUTH_CONSTANTS.FIRST_NAME_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(AUTH_CONSTANTS.FIRST_NAME_MIN_LENGTH)
  @MaxLength(AUTH_CONSTANTS.FIRST_NAME_MAX_LENGTH)
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: AUTH_CONSTANTS.LAST_NAME_MIN_LENGTH,
    maxLength: AUTH_CONSTANTS.LAST_NAME_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(AUTH_CONSTANTS.LAST_NAME_MIN_LENGTH)
  @MaxLength(AUTH_CONSTANTS.LAST_NAME_MAX_LENGTH)
  lastName!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    maxLength: AUTH_CONSTANTS.EMAIL_MAX_LENGTH,
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(AUTH_CONSTANTS.EMAIL_MAX_LENGTH)
  email!: string;

  @ApiProperty({
    description: 'User password (min 8 characters, must contain uppercase, lowercase, and number)',
    example: 'SecurePass123',
    minLength: AUTH_CONSTANTS.PASSWORD_MIN_LENGTH,
    maxLength: AUTH_CONSTANTS.PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(AUTH_CONSTANTS.PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_CONSTANTS.PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty({
    description: 'User preferred locale/language',
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
