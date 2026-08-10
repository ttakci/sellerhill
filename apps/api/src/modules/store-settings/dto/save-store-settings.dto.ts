import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BlacklistType,
  TrackingConversionProvider,
  type SaveStoreSettingsRequest,
  type BlacklistKeyword,
} from '@repo/shared';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayNotEmpty,
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
    description: 'Payload fields where the keyword applies',
    example: [BlacklistType.TITLE, BlacklistType.DESCRIPTION],
    enum: BlacklistType,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(Object.values(BlacklistType), { each: true })
  types!: BlacklistType[];
}

export class SaveStoreSettingsDto implements SaveStoreSettingsRequest {
  @ApiProperty({ description: 'Whether these settings are global', example: true })
  @IsBoolean()
  isGlobal!: boolean;

  @ApiPropertyOptional({ description: 'Store ID (if not global)', example: 'store-123' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Country code. Omitted by focused drawers.', example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'State. Omitted by focused drawers.', example: 'CA' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'ZIP code. Omitted by focused drawers.', example: '90210' })
  @IsOptional()
  @IsString()
  zipCode?: string;

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
    enum: ['local'],
  })
  // Intentionally restricted to LOCAL until the API converter is wired.
  // ApiTrackingConverter.convert() currently throws, so allowing 'api' to
  // persist via any path (direct API, FE bug) would silently break per-account
  // tracking. Remove this guard when a real API provider ships.
  @IsIn([TrackingConversionProvider.LOCAL])
  @IsOptional()
  trackingConversionProvider?: TrackingConversionProvider;

  @ApiPropertyOptional({
    description: 'Master switch for blacklist scanning at listing create. Omitted means "leave unchanged".',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  checkBlacklist?: boolean;

  @ApiPropertyOptional({ description: 'Blacklisted keywords. Omitted by the store-settings drawer.', type: [BlacklistKeywordDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlacklistKeywordDto)
  blacklist?: Omit<BlacklistKeyword, 'id'>[];
}
