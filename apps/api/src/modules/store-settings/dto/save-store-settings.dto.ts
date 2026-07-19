import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrackingConversionProvider, type SaveStoreSettingsRequest, type BlacklistKeyword } from '@repo/shared';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

class BlacklistKeywordDto implements Omit<BlacklistKeyword, 'id'> {
  @ApiProperty({ description: 'Blacklisted keyword', example: 'counterfeit' })
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @ApiProperty({
    description: 'Scope where the keyword applies',
    example: 'both',
    enum: ['title', 'description', 'both'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['title', 'description', 'both'])
  scope!: 'title' | 'description' | 'both';
}

export class SaveStoreSettingsDto implements SaveStoreSettingsRequest {
  @ApiProperty({ description: 'Whether these settings are global', example: true })
  @IsBoolean()
  isGlobal!: boolean;

  @ApiPropertyOptional({ description: 'Store ID (if not global)', example: 'store-123' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty({ description: 'Country code', example: 'US' })
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty({ description: 'State', example: 'CA' })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({ description: 'ZIP code', example: '90210' })
  @IsString()
  @IsNotEmpty()
  zipCode!: string;

  @ApiProperty({
    description: 'Default Amazon tax rate (percent 0–100) used to estimate provisional order profit',
    example: 7,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  amazonTaxRate!: number;

  @ApiPropertyOptional({
    description: 'A2 master toggle. When off, no eBay order is auto-purchased on Amazon.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  autoFulfillEnabled?: boolean;

  @ApiPropertyOptional({
    description: "Carrier-mapping provider used when relaying tracking to eBay. Persisted LOWERCASE ('local' | 'api').",
    default: 'local',
    enum: ['local', 'api'],
  })
  @IsIn([TrackingConversionProvider.LOCAL, TrackingConversionProvider.API])
  @IsOptional()
  trackingConversionProvider?: TrackingConversionProvider;

  @ApiProperty({ description: 'Whether to validate titles', example: true })
  @IsBoolean()
  validateTitle!: boolean;

  @ApiProperty({ description: 'Whether to validate descriptions', example: true })
  @IsBoolean()
  validateDescription!: boolean;

  @ApiProperty({ description: 'Blacklisted keywords', type: [BlacklistKeywordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlacklistKeywordDto)
  blacklist!: Omit<BlacklistKeyword, 'id'>[];
}
