import { Module } from '@nestjs/common';

import { ImageMirrorService } from './image-mirror.service';

@Module({
  providers: [ImageMirrorService],
  exports: [ImageMirrorService],
})
export class ImageMirrorModule {}
