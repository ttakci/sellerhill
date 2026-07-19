import {
  IsBoolean,
  IsEmail,
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

export class CreateAmazonAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

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
}

export class LinkAmazonOrderDto {
  @IsString()
  @IsNotEmpty()
  amazonAccountId!: string;

  @IsString()
  @IsNotEmpty()
  amazonOrderId!: string;
}

export const createAmazonAccountSchema = z.object({
  label: z.string().max(100).optional(),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  twoFactorSecret: z.string().optional(),
});

export const updateAmazonAccountSchema = z.object({
  label: z.string().max(100).optional(),
  email: z.string().email('Please enter a valid email').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  twoFactorSecret: z.string().optional(),
});

export const linkAmazonOrderSchema = z.object({
  amazonAccountId: z.string().min(1, 'Please select an Amazon account'),
  amazonOrderId: z.string().min(1, 'Please enter an Amazon order ID'),
});

export type CreateAmazonAccountFormData = z.infer<typeof createAmazonAccountSchema>;
export type UpdateAmazonAccountFormData = z.infer<typeof updateAmazonAccountSchema>;
export type LinkAmazonOrderFormData = z.infer<typeof linkAmazonOrderSchema>;
