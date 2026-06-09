import type { AmazonAccountStatus } from './amazon.enums';

export class AmazonAccountPublicDto {
  id!: string;
  userId!: string;
  label?: string;
  email!: string;
  status!: AmazonAccountStatus;
  lastVerifiedAt?: string;
  lastUsedAt?: string;
  createdAt!: string;
  updatedAt!: string;
}
