import {
  AmazonMarketplace,
  BEST_SELLERS_CATEGORY_MAX_LENGTH,
  BEST_SELLERS_CATEGORY_REGEX,
  BEST_SELLERS_MAX_PAGE,
  BestSellersListType,
  type BestSellersCategoriesQueryDto as SharedBestSellersCategoriesQueryDto,
  type BestSellersQueryDto as SharedBestSellersQueryDto,
} from '@repo/shared';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/**
 * `GET /v1/best-sellers` query. Implements the shared interface so the web
 * client and this validator cannot drift on field names.
 *
 * `category` is normalized (trim + lowercase) BEFORE validation so
 * ` Electronics ` passes the same grammar the scraper enforces; a blank string
 * is accepted and means the root list.
 */
export class BestSellersQueryDto implements SharedBestSellersQueryDto {
  @IsOptional()
  @IsEnum(BestSellersListType)
  listType?: BestSellersListType;

  @IsOptional()
  @IsString()
  @MaxLength(BEST_SELLERS_CATEGORY_MAX_LENGTH)
  @ValidateIf((o: BestSellersQueryDto) => o.category !== undefined && o.category !== '')
  @Matches(BEST_SELLERS_CATEGORY_REGEX)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(BEST_SELLERS_MAX_PAGE)
  page?: number;

  @IsOptional()
  @IsEnum(AmazonMarketplace)
  marketplace?: AmazonMarketplace;
}

/** `GET /v1/best-sellers/categories` query: the root department list of one list type. */
export class BestSellersCategoriesQueryDto implements SharedBestSellersCategoriesQueryDto {
  @IsOptional()
  @IsEnum(BestSellersListType)
  listType?: BestSellersListType;

  @IsOptional()
  @IsEnum(AmazonMarketplace)
  marketplace?: AmazonMarketplace;
}
