import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import type { UpdatePlatformSettingRequest } from '../../domain/admin/platform-settings.types';

/**
 * PUT /admin/settings/:key — the value always travels as a string; the
 * server-side registry owns type coercion, bounds and enum validation so the
 * rules live in exactly one place.
 */
export class UpdatePlatformSettingDto implements UpdatePlatformSettingRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  value!: string;
}
