import { Module } from '@nestjs/common';

import { AssistantModule } from '../assistant/assistant.module';
import { AuthModule } from '../auth/auth.module';

import { SupportConversationRepository } from './repositories/support-conversation.repository';
import { SupportPresenceService } from './support-presence.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({ imports: [AssistantModule, AuthModule], controllers: [SupportController],
  providers: [SupportConversationRepository, SupportPresenceService, SupportService],
  exports: [SupportConversationRepository, SupportPresenceService, SupportService] })
export class SupportModule {}
