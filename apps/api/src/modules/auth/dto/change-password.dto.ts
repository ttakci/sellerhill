import { ApiProperty } from '@nestjs/swagger';
import { AUTH_CONSTANTS, type ChangePasswordRequest } from '@repo/shared';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty({ description: 'Current password', example: 'OldPass123' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ description: 'New password', example: 'NewSecurePass123' })
  @IsString()
  @MinLength(AUTH_CONSTANTS.PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_CONSTANTS.PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
