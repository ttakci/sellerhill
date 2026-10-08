import { ApiPropertyOptional } from '@nestjs/swagger';
import { DIGEST_SEND_HOUR_MAX, DIGEST_SEND_HOUR_MIN, type UpdateProfileRequest } from '@repo/shared';
import { IsBoolean, IsInt, IsString, IsOptional, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateProfileDto implements UpdateProfileRequest {
  @ApiPropertyOptional({ description: 'User first name', example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'User last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number in E.164 format', example: '+14155552671' })
  @IsOptional()
  @IsString()
  @ValidateIf((o: UpdateProfileDto) => o.phoneNumber !== undefined && o.phoneNumber !== '')
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phoneNumber must be a valid E.164 phone number' })
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Avatar URL', example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Job title', example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'User bio' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'City/State', example: 'New York, NY' })
  @IsOptional()
  @IsString()
  cityState?: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '10001' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ description: 'IANA time zone', example: 'Europe/Istanbul' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: 'Daily summary e-mail on/off' })
  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Local hour the daily summary is sent', example: 8 })
  @IsOptional()
  @IsInt()
  @Min(DIGEST_SEND_HOUR_MIN)
  @Max(DIGEST_SEND_HOUR_MAX)
  digestSendHour?: number;
}
