import type { AmazonAccountStatus } from './amazon.enums';

export class AmazonAccountPublicDto {
  id!: string;
  userId!: string;
  label?: string;
  email!: string;
  status!: AmazonAccountStatus;
  hasTwoFactor?: boolean;
  lastVerificationError?: string | null;
  lastVerifiedAt?: string;
  lastUsedAt?: string;
  createdAt!: string;
  updatedAt!: string;
}
