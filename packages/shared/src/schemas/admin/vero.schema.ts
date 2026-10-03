import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

import {
  VERO_KEYWORDS_MAX_PER_REQUEST,
  type AddVeroKeywordsRequest,
} from '../../domain/admin/vero.types';

/** Add brand names to the platform VeRO list. */
export class AddVeroKeywordsDto implements AddVeroKeywordsRequest {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(VERO_KEYWORDS_MAX_PER_REQUEST)
  @IsString({ each: true })
  keywords!: string[];
}
