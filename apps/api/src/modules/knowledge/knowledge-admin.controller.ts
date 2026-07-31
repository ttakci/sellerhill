import { InjectQueue } from '@nestjs/bullmq';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@repo/shared';
import type { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorSurface } from '../auth/operator-surface.decorator';
import { PrivilegedSessionGuard } from '../auth/privileged-session.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { KNOWLEDGE_INGESTION_JOB, KNOWLEDGE_INGESTION_QUEUE, KNOWLEDGE_JOB_ATTEMPTS } from './knowledge-ingestion.constants';
import { KnowledgeIngestionService } from './knowledge-ingestion.service';

class KnowledgeRootDto { root!: string; }

@Controller('admin/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard, PrivilegedSessionGuard)
@OperatorSurface()
@Roles(UserRole.ADMIN)
export class KnowledgeAdminController {
 constructor(private readonly ingestion:KnowledgeIngestionService,@InjectQueue(KNOWLEDGE_INGESTION_QUEUE) private readonly queue:Queue){}
 @Post('validate') validate(@Body() body:KnowledgeRootDto){return this.ingestion.dryRun(body.root);}
 @Post('dry-run') dryRun(@Body() body:KnowledgeRootDto){return this.ingestion.dryRun(body.root);}
 @Post('ingest') async ingest(@Body() body:KnowledgeRootDto){const validated=await this.ingestion.validate(body.root);const job=await this.queue.add(KNOWLEDGE_INGESTION_JOB,stampCurrentCorrelation({ root: body.root }),{jobId:`knowledge-${validated.manifestChecksum}`,attempts:KNOWLEDGE_JOB_ATTEMPTS,backoff:{type:'exponential',delay:5000},removeOnComplete:100,removeOnFail:100});return {jobId:job.id,manifestChecksum:validated.manifestChecksum};}
 @Post('publish/:releaseId') async publish(@Param('releaseId') releaseId:string){await this.ingestion.publish(releaseId);return this.ingestion.status();}
 @Get('status') status(){return this.ingestion.status();}
 @Post('rollback/:releaseId') async rollback(@Param('releaseId') releaseId:string){await this.ingestion.rollback(releaseId);return this.ingestion.status();}
}
