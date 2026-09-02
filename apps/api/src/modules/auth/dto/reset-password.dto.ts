import { ApiProperty } from '@nestjs/swagger';
import { AUTH_CONSTANTS, type ResetPasswordRequest } from '@repo/shared';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty({ description: 'Opaque token from the reset link', example: 'x8Kf...' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New password', example: 'NewSecurePass123' })
  @IsString()
  @MinLength(AUTH_CONSTANTS.PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_CONSTANTS.PASSWORD_MAX_LENGTH)
  password!: string;
}
