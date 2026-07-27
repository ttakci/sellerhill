import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { DatabaseService } from '../common/database/database.service';

interface PgvectorHealthRow {
  extension_installed: boolean;
  cosine_operator: boolean;
  l2_operator: boolean;
  ip_operator: boolean;
  cosine_opclass: boolean;
  l2_opclass: boolean;
  ip_opclass: boolean;
}

@Injectable()
export class PgvectorHealthIndicator extends HealthIndicator {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const metric = this.config.get<string>('EMBEDDING_DISTANCE_METRIC', 'cosine');
    const dimensions = this.config.get<number>('EMBEDDING_DIMENSIONS', 1536);
    const rows = await this.database.query<PgvectorHealthRow>(`
      SELECT
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS extension_installed,
        to_regoperator('<=>(vector,vector)') IS NOT NULL AS cosine_operator,
        to_regoperator('<->(vector,vector)') IS NOT NULL AS l2_operator,
        to_regoperator('<#>(vector,vector)') IS NOT NULL AS ip_operator,
        EXISTS (SELECT 1 FROM pg_opclass WHERE opcname = 'vector_cosine_ops') AS cosine_opclass,
        EXISTS (SELECT 1 FROM pg_opclass WHERE opcname = 'vector_l2_ops') AS l2_opclass,
        EXISTS (SELECT 1 FROM pg_opclass WHERE opcname = 'vector_ip_ops') AS ip_opclass
    `);
    const row = rows[0];
    const metricReady =
      metric === 'cosine'
        ? row?.cosine_operator && row.cosine_opclass
        : metric === 'l2'
          ? row?.l2_operator && row.l2_opclass
          : row?.ip_operator && row.ip_opclass;
    const healthy = Boolean(row?.extension_installed && metricReady && dimensions > 0);
    const result = this.getStatus(key, healthy, { metric, dimensions });
    if (!healthy) {throw new HealthCheckError('pgvector health check failed', result);}
    return result;
  }
}
