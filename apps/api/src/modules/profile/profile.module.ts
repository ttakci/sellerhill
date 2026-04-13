import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
