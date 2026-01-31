import { IsNumber, IsOptional, IsUrl } from 'class-validator';

export class UpdateOrderAmazonDetailsDto {
  @IsOptional()
  @IsUrl()
  amazonOrderUrl?: string;

  @IsOptional()
  @IsUrl()
  amazonTrackingUrl?: string;

  @IsOptional()
  @IsNumber()
  amazonTax?: number;

  @IsOptional()
  @IsNumber()
  amazonShipping?: number;
}
