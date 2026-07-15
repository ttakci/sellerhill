import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  type UpdateListingSettingsGroupRequest,
  type PriceRange,
  type StockConfig,
  type FeeConfig,
  type TemplateConfig,
  TemplateType,
} from '@repo/shared';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsIn, IsNotEmpty } from 'class-validator';

class PriceRangeDto implements Omit<PriceRange, 'id'> {
  @ApiPropertyOptional({ description: 'Minimum price', example: 10.0 })
  @IsNumber()
  @Min(0)
  minPrice!: number;

  @ApiPropertyOptional({ description: 'Maximum price', example: 100.0 })
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
  @ApiPropertyOptional({ description: 'Default stock quantity', example: 10 })
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
  @ApiPropertyOptional({ description: 'eBay fee percentage', example: 13.0 })
  @IsNumber()
  @Min(0)
  ebayFeePercent!: number;

  @ApiPropertyOptional({ description: 'Fixed fee amount', example: 0.3 })
  @IsNumber()
  @Min(0)
  fixedFeeAmount!: number;

  @ApiPropertyOptional({ description: 'Tax percentage', example: 10.0 })
  @IsNumber()
  @Min(0)
  taxPercent!: number;
}

class TemplateConfigDto implements TemplateConfig {
  @ApiPropertyOptional({ description: 'Template type', enum: [TemplateType.CUSTOM, TemplateType.PREDEFINED] })
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

export class UpdateListingSettingsGroupDto implements UpdateListingSettingsGroupRequest {
  @ApiPropertyOptional({ description: 'Settings group name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Settings group description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Repricing strategy price ranges', type: [PriceRangeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceRangeDto)
  repricingStrategy?: Omit<PriceRange, 'id'>[];

  @ApiPropertyOptional({ description: 'Stock configuration', type: StockConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StockConfigDto)
  stock?: StockConfig;

  @ApiPropertyOptional({ description: 'Fee configuration', type: FeeConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FeeConfigDto)
  fees?: FeeConfig;

  @ApiPropertyOptional({ description: 'Template configuration', type: TemplateConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemplateConfigDto)
  templates?: TemplateConfig;
}
