import { IsNumber, IsOptional, IsUrl } from 'class-validator';
import { z } from 'zod';

// Backend DTO (class-validator)
export class UpdateOrderAmazonDetailsDto {
  @IsOptional()
  @IsUrl()
  amazonOrderUrl?: string;

  @IsOptional()
  @IsUrl()
  amazonTrackingUrl?: string;

  @IsOptional()
  @IsNumber()
  amazonTax?: number;

  @IsOptional()
  @IsNumber()
  amazonShipping?: number;
}

// Frontend Zod schema
export const amazonDetailsSchema = z.object({
  amazonOrderUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  amazonTrackingUrl: z
    .string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional(),
  amazonTax: z
    .number()
    .min(0, 'Must be a positive number')
    .optional()
    .or(z.nan().transform(() => undefined)),
  amazonShipping: z
    .number()
    .min(0, 'Must be a positive number')
    .optional()
    .or(z.nan().transform(() => undefined)),
});

export type AmazonDetailsFormData = z.infer<typeof amazonDetailsSchema>;
