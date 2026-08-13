import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { z } from 'zod';

import { SUPPORTED_AMAZON_MARKETPLACES } from '../../domain/amazon/amazon.constants';
import { AmazonMarketplace } from '../../domain/amazon/amazon.enums';
import { ProxyConnectionType } from '../../domain/amazon/amazon.types';

export class CreateAmazonAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  // Storefront this buyer account operates on (migration 081). Optional —
  // defaults to AmazonMarketplace.AMAZON_US in AmazonAccountsService — and
  // deliberately absent from UpdateAmazonAccountDto: immutable after create.
  @IsOptional()
  @IsIn(SUPPORTED_AMAZON_MARKETPLACES)
  marketplace?: AmazonMarketplace;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  twoFactorSecret?: string;

  // A2 auto-fulfillment per-account overrides. Enabling requires the proxy to be
  // configured and a non-null cap; the guardrail is enforced in AmazonAccountsService.
  @IsOptional()
  @IsBoolean()
  autoFulfillEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  autoFulfillCapTotal?: number | null;

  @IsOptional()
  @IsBoolean()
  autoFulfillDryRun?: boolean;

  // Self-service proxy (migration 080). User-supplied; when omitted/disabled,
  // browser automation for this account runs bare-IP.
  @IsOptional()
  @IsBoolean()
  proxyEnabled?: boolean;

  @IsOptional()
  @IsIn(Object.values(ProxyConnectionType))
  proxyConnectionType?: ProxyConnectionType | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  proxyHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  proxyPort?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  proxyUsername?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  proxyPassword?: string | null;
}

export class UpdateAmazonAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  twoFactorSecret?: string;

  // A2 auto-fulfillment per-account overrides. Enabling requires the proxy to be
  // configured and a non-null cap; the guardrail is enforced in AmazonAccountsService.
  @IsOptional()
  @IsBoolean()
  autoFulfillEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  autoFulfillCapTotal?: number | null;

  @IsOptional()
  @IsBoolean()
  autoFulfillDryRun?: boolean;

  // Self-service proxy (migration 080).
  @IsOptional()
  @IsBoolean()
  proxyEnabled?: boolean;

  @IsOptional()
  @IsIn(Object.values(ProxyConnectionType))
  proxyConnectionType?: ProxyConnectionType | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  proxyHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  proxyPort?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  proxyUsername?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  proxyPassword?: string | null;
}

export class LinkAmazonOrderDto {
  @IsString()
  @IsNotEmpty()
  amazonAccountId!: string;

  @IsString()
  @IsNotEmpty()
  amazonOrderId!: string;
}

/** Self-service proxy fields shared by create/update (migration 080). */
const proxyFields = {
  proxyEnabled: z.boolean().optional(),
  proxyConnectionType: z.nativeEnum(ProxyConnectionType).nullable().optional(),
  proxyHost: z.string().max(255).nullable().optional(),
  proxyPort: z.number().int().min(1).max(65535).nullable().optional(),
  proxyUsername: z.string().max(255).nullable().optional(),
  proxyPassword: z.string().max(255).nullable().optional(),
};

export const createAmazonAccountSchema = z.object({
  label: z.string().max(100).optional(),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  twoFactorSecret: z.string().optional(),
  // Storefront this buyer account operates on. Optional — defaults to
  // AmazonMarketplace.AMAZON_US server-side. Immutable after creation, so
  // updateAmazonAccountSchema deliberately has no matching field.
  marketplace: z.nativeEnum(AmazonMarketplace).optional(),
  // A2 auto-fulfillment per-account overrides (optional on create; backend
  // guardrail enforces a non-null cap when autoFulfillEnabled = true).
  autoFulfillEnabled: z.boolean().optional(),
  autoFulfillCapTotal: z.number().min(0).max(1_000_000).nullable().optional(),
  autoFulfillDryRun: z.boolean().optional(),
  ...proxyFields,
});

export const updateAmazonAccountSchema = z.object({
  label: z.string().max(100).optional(),
  email: z.string().email('Please enter a valid email').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  twoFactorSecret: z.string().optional(),
  // A2 auto-fulfillment per-account overrides. Enabling requires a non-null
  // cap; enforced in AmazonAccountsService.
  autoFulfillEnabled: z.boolean().optional(),
  autoFulfillCapTotal: z.number().min(0).max(1_000_000).nullable().optional(),
  autoFulfillDryRun: z.boolean().optional(),
  ...proxyFields,
});

export const linkAmazonOrderSchema = z.object({
  amazonAccountId: z.string().min(1, 'Please select an Amazon account'),
  amazonOrderId: z.string().min(1, 'Please enter an Amazon order ID'),
});

export type CreateAmazonAccountFormData = z.infer<typeof createAmazonAccountSchema>;
export type UpdateAmazonAccountFormData = z.infer<typeof updateAmazonAccountSchema>;
export type LinkAmazonOrderFormData = z.infer<typeof linkAmazonOrderSchema>;
