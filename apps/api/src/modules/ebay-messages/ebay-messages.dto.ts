import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EBAY_BULK_CONVERSATIONS_MAX,
  EBAY_CONVERSATIONS_MAX_LIMIT,
  EbayConversationStatus,
  EbayConversationType,
  type EbayBulkConversationStatus,
  type EbayConversationMutableStatus,
  type EbayConversationRead,
  type EbayConversationsQuery,
  type EbayReplyMessage,
} from '@repo/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * class-validator mirrors of the shared Zod schemas
 * (`packages/shared/src/schemas/ebay-messages`). Message length is NOT capped
 * here: the service refuses an over-long reply with its own localized key
 * (`ebay.errors.messageTooLong`) rather than a generic validation error.
 */

const MUTABLE_STATUSES: EbayConversationMutableStatus[] = [
  EbayConversationStatus.ACTIVE,
  EbayConversationStatus.ARCHIVE,
  EbayConversationStatus.DELETE,
];

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class EbayConversationsQueryDto implements EbayConversationsQuery {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ebayAccountId!: string;

  @ApiPropertyOptional({ enum: EbayConversationType, description: 'Omitted = both types merged' })
  @IsOptional()
  @IsEnum(EbayConversationType)
  type?: EbayConversationType;

  @ApiPropertyOptional({ enum: EbayConversationStatus })
  @IsOptional()
  @IsEnum(EbayConversationStatus)
  status?: EbayConversationStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: EBAY_CONVERSATIONS_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(EBAY_CONVERSATIONS_MAX_LIMIT)
  limit: number = 25;
}

export class EbayThreadQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ebayAccountId!: string;

  @ApiProperty({ enum: EbayConversationType })
  @IsEnum(EbayConversationType)
  type!: EbayConversationType;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: EBAY_CONVERSATIONS_MAX_LIMIT, minimum: 1, maximum: EBAY_CONVERSATIONS_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(EBAY_CONVERSATIONS_MAX_LIMIT)
  limit: number = EBAY_CONVERSATIONS_MAX_LIMIT;
}

export class EbayReplyMessageDto implements EbayReplyMessage {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ebayAccountId!: string;

  @ApiProperty({ enum: EbayConversationType })
  @IsEnum(EbayConversationType)
  type!: EbayConversationType;

  @ApiProperty({ description: 'Reply text; at most 2000 characters after trimming.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class EbayConversationReadDto implements EbayConversationRead {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ebayAccountId!: string;

  @ApiProperty({ enum: EbayConversationType })
  @IsEnum(EbayConversationType)
  type!: EbayConversationType;

  @ApiProperty()
  @IsBoolean()
  read!: boolean;
}

export class EbayBulkConversationStatusDto implements EbayBulkConversationStatus {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ebayAccountId!: string;

  @ApiProperty({ enum: EbayConversationType })
  @IsEnum(EbayConversationType)
  type!: EbayConversationType;

  @ApiProperty({ type: [String], maxItems: EBAY_BULK_CONVERSATIONS_MAX })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EBAY_BULK_CONVERSATIONS_MAX)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  conversationIds!: string[];

  @ApiProperty({ enum: MUTABLE_STATUSES })
  @IsIn(MUTABLE_STATUSES)
  status!: EbayConversationMutableStatus;
}

export class EbayRefreshUnreadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ebayAccountId!: string;
}
