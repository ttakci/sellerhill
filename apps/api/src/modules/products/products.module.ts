import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { ProductsService } from './products.service';

@Module({
  imports: [DatabaseModule],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
