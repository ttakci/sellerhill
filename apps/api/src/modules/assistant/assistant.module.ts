import { Module } from '@nestjs/common';

import { AssistantContextRouterService } from './assistant-context-router.service';
import { AssistantContextService } from './assistant-context.service';
import { AssistantConversationService } from './assistant-conversation.service';
import { AssistantCursorService } from './assistant-cursor.service';
import { AssistantEventService } from './assistant-event.service';
import { AssistantGenerationService } from './assistant-generation.service';
import { AssistantOutboxScheduler } from './assistant-outbox.scheduler';
import { AssistantOutputValidatorService } from './assistant-output-validator.service';
import { AssistantRetentionProcessor } from './assistant-retention.processor';
import { AssistantRetentionService } from './assistant-retention.service';
import { AssistantSummaryProcessor } from './assistant-summary.processor';
import { AssistantConversationRepository } from './repositories/assistant-conversation.repository';
import { AssistantOutboxRepository } from './repositories/assistant-outbox.repository';
import { AssistantToolService } from './tools/assistant-tool.service';

@Module({
  providers: [AssistantConversationRepository, AssistantOutboxRepository, AssistantConversationService,
    AssistantCursorService, AssistantEventService, AssistantOutboxScheduler, AssistantRetentionService,
    AssistantContextRouterService, AssistantContextService, AssistantOutputValidatorService, AssistantToolService,
    AssistantGenerationService, AssistantSummaryProcessor, AssistantRetentionProcessor],
  exports: [AssistantConversationRepository, AssistantOutboxRepository, AssistantConversationService,
    AssistantCursorService, AssistantEventService, AssistantContextRouterService, AssistantContextService,
    AssistantOutputValidatorService, AssistantToolService, AssistantGenerationService,
    AssistantSummaryProcessor, AssistantRetentionProcessor],
})
export class AssistantModule {}
