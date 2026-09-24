import { Module } from '@nestjs/common';

import { ImageMirrorGcService } from './image-mirror-gc.service';
import { ImageMirrorService } from './image-mirror.service';

@Module({
  providers: [ImageMirrorService, ImageMirrorGcService],
  exports: [ImageMirrorService],
})
export class ImageMirrorModule {}
