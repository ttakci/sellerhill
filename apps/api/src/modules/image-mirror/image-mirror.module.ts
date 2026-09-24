import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { IMAGE_MIRROR_GC_QUEUE, ImageMirrorGcService } from './image-mirror-gc.service';
import { ImageMirrorService } from './image-mirror.service';

@Module({
  imports: [BullModule.registerQueue({ name: IMAGE_MIRROR_GC_QUEUE })],
  providers: [ImageMirrorService, ImageMirrorGcService],
  exports: [ImageMirrorService],
})
export class ImageMirrorModule {}
