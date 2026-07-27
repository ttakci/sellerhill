import { SupportAgentAvailability, SupportQueueFilter, SupportTransferKind } from '@repo/shared';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SupportQueueQueryDto {
  @IsOptional() @IsEnum(SupportQueueFilter) filter?: SupportQueueFilter;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class SupportMessageDto {
  @IsUUID() clientMessageId!: string;
  @IsString() @MinLength(1) @MaxLength(12000) content!: string;
}
export class SupportReadDto { @IsString() @MinLength(1) @MaxLength(20) throughSequence!: string; }
export class SupportTransferDto {
  @IsEnum(SupportTransferKind) kind!: SupportTransferKind;
  @IsOptional() @IsUUID() targetSupportUserId?: string;
}
export class SupportPresencePreferenceDto {
  @IsEnum(SupportAgentAvailability) availability!: SupportAgentAvailability;
}
export class SupportHeartbeatDto { @IsUUID() connectionId!: string; }
