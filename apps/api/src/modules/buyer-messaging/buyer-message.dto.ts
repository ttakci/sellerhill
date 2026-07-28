import { BuyerMessageEventType } from '@repo/shared';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveBuyerMessagingDto {
  @IsBoolean()
  enabled!: boolean;

  @IsObject()
  events!: Record<string, unknown>;
}

export class ListBuyerMessageTemplatesQueryDto {
  @IsOptional()
  @IsEnum(BuyerMessageEventType)
  eventType?: BuyerMessageEventType;
}

export class CreateBuyerMessageTemplateDto {
  @IsEnum(BuyerMessageEventType)
  eventType!: BuyerMessageEventType;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;
}

export class UpdateBuyerMessageTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;
}
