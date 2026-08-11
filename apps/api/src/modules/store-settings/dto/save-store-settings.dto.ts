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
    description:
      "How the Amazon tracking number is relayed to eBay. Persisted LOWERCASE. " +
      "'local' passes it through as Amazon_Logistics; 'aquiline' converts it to an " +
      "AQUAA…YQ number under the AQUILINE carrier so the buyer never sees the supplier.",
    default: 'local',
    enum: ['local', 'aquiline'],
  })
  // 'aquiline' is accepted now that a real converter ships
  // (TrackingConversionService). It is still safe to store with no API key
  // configured: the service degrades to the local pass-through and logs, so a
  // half-configured account behaves exactly as it did before.
  //
  // The legacy 'api' spelling stays REJECTED on write. It resolves correctly on
  // read for safety, but writing it would spread a second name for one choice.
  @IsIn([TrackingConversionProvider.LOCAL, TrackingConversionProvider.AQUILINE])
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
