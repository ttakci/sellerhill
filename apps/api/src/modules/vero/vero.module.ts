import { Module } from '@nestjs/common';

import { VeroService } from './vero.service';

/**
 * The platform VeRO list. Its own dependency-free module (DatabaseModule is
 * global) so both the listings worker, which checks it, and the admin module,
 * which edits it, can import it without importing each other — see
 * `module-cycle.guard.spec.ts`.
 */
@Module({
  providers: [VeroService],
  exports: [VeroService],
})
export class VeroModule {}
