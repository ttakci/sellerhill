import 'reflect-metadata';
import { join, resolve } from 'path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { KnowledgeAdminOperation } from '../modules/knowledge/knowledge-ingestion.constants';
import { KnowledgeIngestionService } from '../modules/knowledge/knowledge-ingestion.service';

async function main():Promise<void>{
 const operation=process.argv[2] as KnowledgeAdminOperation|undefined; const argument=process.argv[3];
 if(!operation||!Object.values(KnowledgeAdminOperation).includes(operation)){throw new Error('knowledge_operation_required');}
 const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
 try{const service=app.get(KnowledgeIngestionService);const root=resolve(argument??join(process.cwd(),'..','..','docs','help'));let result:unknown;
  switch(operation){case KnowledgeAdminOperation.VALIDATE:case KnowledgeAdminOperation.DRY_RUN:result=await service.dryRun(root);break;case KnowledgeAdminOperation.INGEST:result=await service.ingest(root);break;case KnowledgeAdminOperation.PUBLISH:if(!argument){throw new Error('release_not_found');}await service.publish(argument);result=await service.status();break;case KnowledgeAdminOperation.STATUS:result=await service.status();break;case KnowledgeAdminOperation.ROLLBACK:if(!argument){throw new Error('release_not_found');}await service.rollback(argument);result=await service.status();break;}
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
 }finally{await app.close();}
}
void main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:'ingestion_failed'}\n`);process.exitCode=1;});
