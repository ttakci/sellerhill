import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { z } from 'zod';

import type { CreateProxyRequest, UpdateProxyRequest } from '../../domain/admin/admin.types';
import { ProxyStatus } from '../../domain/amazon/amazon.types';

/**
 * POST /admin/proxies — operator registers a purchased fixed ISP proxy.
 * The password arrives plaintext over TLS and is encrypted (AES-256-GCM,
 * `enc:` prefix) before it is persisted; it is never returned by any endpoint.
 */
export class CreateProxyDto implements CreateProxyRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  // Micro-USD (1/1,000,000 USD). Pair-coupled with currency.
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyCostMicros?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

/** PATCH /admin/proxies/:id — only provided fields change; null clears. */
export class UpdateProxyDto implements UpdateProxyRequest {
  @IsOptional()
  @IsIn(Object.values(ProxyStatus))
  status?: ProxyStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string | null;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyCostMicros?: number | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string | null;
}

/** FE add-proxy form. Cost is entered in USD and converted to micros at submit. */
export const createProxyFormSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
  label: z.string().max(100).optional(),
  expiresAt: z.string().optional(),
  monthlyCostUsd: z.coerce.number().min(0).optional(),
});

export type CreateProxyFormData = z.infer<typeof createProxyFormSchema>;
