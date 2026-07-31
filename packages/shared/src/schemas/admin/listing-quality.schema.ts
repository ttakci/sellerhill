import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import type { UpsertAspectDefaultRequest } from '../../domain/admin/listing-quality.types';

/**
 * Curate one item-specific value for a category.
 *
 * Length caps mirror eBay's own limits so an over-long value is rejected here
 * rather than at publish time.
 */
export class UpsertAspectDefaultDto implements UpsertAspectDefaultRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  marketplaceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  aspectName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(65)
  value!: string;

  /** When true the value also beats scraped product data, not just the fallbacks. */
  @IsOptional()
  @IsBoolean()
  isOverride?: boolean;
}
