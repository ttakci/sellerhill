import { AssistantConversationStatus, AssistantHandoffReason, SUPPORTED_LOCALES, type SupportedLocale } from '@repo/shared';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateAssistantConversationDto {
  @IsEnum(SUPPORTED_LOCALES) locale!: SupportedLocale;
  @IsUUID() clientConversationId!: string;
}
export class UpdateAssistantConversationDto { @IsString() @MinLength(1) @MaxLength(160) title!: string; }
export class MarkAssistantConversationReadDto { @IsString() @Transform(({ value }) => String(value)) throughSequence!: string; }
export class CreateAssistantMessageDto {
  @IsUUID() clientMessageId!: string;
  @IsString() @MinLength(1) @MaxLength(8000) content!: string;
}
export class RetryAssistantMessageDto { @IsUUID() clientAttemptId!: string; }
export class RequestAssistantSupportDto {
  @IsEnum(AssistantHandoffReason) reason!: AssistantHandoffReason;
  @IsOptional() @IsUUID() sourceMessageId?: string;
}
export class UnarchiveAssistantConversationDto { @IsEnum(AssistantConversationStatus) status!: AssistantConversationStatus; }
export class AssistantConversationListQueryDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsEnum(AssistantConversationStatus) status?: AssistantConversationStatus;
}
export class AssistantMessageListQueryDto {
  @IsOptional() @IsString() beforeSequence?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
export class AssistantEventsQueryDto { @IsOptional() @IsString() @MaxLength(2048) after?: string; }
