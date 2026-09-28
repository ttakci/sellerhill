import { IsOptional, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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

/**
 * POST /admin/settings/scraper/proxies/verify — `proxies` is the same
 * comma/newline-separated grammar as the `scraper.proxies` setting itself.
 * Omitted, the server tests the CURRENTLY SAVED list instead of a draft.
 */
export class VerifyScraperProxiesDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  proxies?: string;
}
