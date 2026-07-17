import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type CreateListingSettingsGroupRequest,
  type ListingContentConfig,
  type PriceRange,
  type StockConfig,
  type FeeConfig,
  type TemplateConfig,
  TemplateType,
} from '@repo/shared';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsIn,
  IsBoolean,
} from 'class-validator';

class PriceRangeDto implements Omit<PriceRange, 'id'> {
  @ApiProperty({ description: 'Minimum price', example: 10.0 })
  @IsNumber()
  @Min(0)
  minPrice!: number;

  @ApiProperty({ description: 'Maximum price', example: 100.0 })
  @IsNumber()
  @Min(0)
  maxPrice!: number;

  @ApiPropertyOptional({ description: 'Profit margin percentage', example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  profitMarginPercent?: number;

  @ApiPropertyOptional({ description: 'Fixed profit amount', example: 5.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedProfitAmount?: number;
}

class StockConfigDto implements StockConfig {
  @ApiProperty({ description: 'Default stock quantity', example: 10 })
  @IsNumber()
  @Min(0)
  defaultQuantity!: number;

  @ApiPropertyOptional({
    description: 'Stock buffer threshold — Amazon stock must exceed defaultQuantity + buffer to list',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockBuffer?: number;
}

class FeeConfigDto implements FeeConfig {
  @ApiProperty({ description: 'eBay fee percentage', example: 13.0 })
  @IsNumber()
  @Min(0)
  ebayFeePercent!: number;

  @ApiProperty({ description: 'Fixed fee amount', example: 0.3 })
  @IsNumber()
  @Min(0)
  fixedFeeAmount!: number;

  @ApiProperty({ description: 'Tax percentage', example: 10.0 })
  @IsNumber()
  @Min(0)
  taxPercent!: number;
}

class TemplateConfigDto implements TemplateConfig {
  @ApiProperty({
    description: 'Template type',
    example: 'custom',
    enum: [TemplateType.CUSTOM, TemplateType.PREDEFINED],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([TemplateType.CUSTOM, TemplateType.PREDEFINED])
  type!: TemplateType;

  @ApiPropertyOptional({ description: 'Custom template HTML' })
  @IsOptional()
  @IsString()
  customTemplateHtml?: string;

  @ApiPropertyOptional({ description: 'Predefined template ID' })
  @IsOptional()
  @IsString()
  predefinedTemplateId?: string;
}

class ListingContentConfigDto implements ListingContentConfig {
  @ApiPropertyOptional({ description: 'Strip brand from eBay title on create' })
  @IsOptional()
  @IsBoolean()
  stripBrandFromTitle!: boolean;

  @ApiPropertyOptional({ description: 'AI title rewrite scaffold flag' })
  @IsOptional()
  @IsBoolean()
  aiTitleEnabled!: boolean;

  @ApiPropertyOptional({ description: 'AI description rewrite scaffold flag' })
  @IsOptional()
  @IsBoolean()
  aiDescriptionEnabled!: boolean;
}

export class CreateListingSettingsGroupDto implements CreateListingSettingsGroupRequest {
  @ApiProperty({ description: 'Settings group name', example: 'Default Repricing' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Settings group description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Repricing strategy price ranges', type: [PriceRangeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceRangeDto)
  repricingStrategy!: Omit<PriceRange, 'id'>[];

  @ApiProperty({ description: 'Stock configuration', type: StockConfigDto })
  @ValidateNested()
  @Type(() => StockConfigDto)
  stock!: StockConfig;

  @ApiProperty({ description: 'Fee configuration', type: FeeConfigDto })
  @ValidateNested()
  @Type(() => FeeConfigDto)
  fees!: FeeConfig;

  @ApiProperty({ description: 'Template configuration', type: TemplateConfigDto })
  @ValidateNested()
  @Type(() => TemplateConfigDto)
  templates!: TemplateConfig;

  @ApiPropertyOptional({ description: 'Listing content policy', type: ListingContentConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ListingContentConfigDto)
  content?: ListingContentConfig;
}
