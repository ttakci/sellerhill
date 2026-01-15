import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  type BlacklistKeyword,
  type SaveStoreSettingsRequest,
  type StoreSettingsResponse
} from '@repo/shared';
import { DatabaseService } from '../../common/database/database.service';

/**
 * Store Settings Entity
 */
interface StoreSettingsEntity {
  id: string;
  user_id: string;
  store_id: string | null;
  is_global: boolean;
  country: string;
  state: string;
  zip_code: string;
  validate_title: boolean;
  validate_description: boolean;
  blacklist: string; // JSON string in DB
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class StoreSettingsService implements OnModuleInit {
  private readonly logger = new Logger(StoreSettingsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureTableExists();
  }

  /**
   * Ensure store_settings table exists with correct schema
   */
  private async ensureTableExists() {
    this.logger.log('Ensuring store_settings table exists...');
    
    // Check if user_id column exists
    const columnCheck = await this.databaseService.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'store_settings' AND column_name = 'user_id'
    `);

    if (columnCheck.length === 0) {
      this.logger.warn('Schema mismatch: store_settings lacks user_id. Recreating table for multi-tenancy.');
      await this.databaseService.query(`DROP TABLE IF EXISTS store_settings CASCADE;`);
    }

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_id UUID,
        is_global BOOLEAN DEFAULT FALSE,
        country VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        zip_code VARCHAR(20) NOT NULL,
        validate_title BOOLEAN DEFAULT TRUE,
        validate_description BOOLEAN DEFAULT FALSE,
        blacklist JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure idx on user and store
    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_store_settings_user_id ON store_settings(user_id);
      CREATE INDEX IF NOT EXISTS idx_store_settings_store_id ON store_settings(store_id);
    `);

    // UNIQUE constraints scoped to user
    // 1. One global setting per user
    await this.databaseService.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_user_global 
      ON store_settings (user_id, is_global) 
      WHERE (is_global = TRUE);
    `);

    // 2. One specific setting per store per user
    await this.databaseService.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_user_store 
      ON store_settings (user_id, store_id) 
      WHERE (store_id IS NOT NULL);
    `);
  }

  /**
   * Get settings for a specific store or global
   */
  async getSettings(userId: string, storeId?: string): Promise<StoreSettingsResponse> {
    const query = storeId 
      ? `SELECT * FROM store_settings WHERE user_id = $1 AND store_id = $2`
      : `SELECT * FROM store_settings WHERE user_id = $1 AND is_global = TRUE`;
    
    const params = storeId ? [userId, storeId] : [userId];
    
    const results = await this.databaseService.query<StoreSettingsEntity>(query, params);
    
    if (results.length === 0) {
        // Return default settings if none found
        return {
            id: '',
            isGlobal: !storeId,
            storeId,
            country: 'United States',
            state: 'Delaware',
            zipCode: '19702',
            validateTitle: true,
            validateDescription: false,
            blacklist: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    
    return this.mapToDto(results[0]);
  }

  /**
   * Save settings
   */
  async saveSettings(userId: string, dto: SaveStoreSettingsRequest): Promise<StoreSettingsResponse> {
    const { isGlobal, storeId, country, state, zipCode, validateTitle, validateDescription, blacklist } = dto;
    
    const blacklistJson = JSON.stringify(blacklist);
    
    let result: StoreSettingsEntity[];
    
    if (isGlobal) {
        // Upsert global settings for THIS user
        result = await this.databaseService.query<StoreSettingsEntity>(`
            INSERT INTO store_settings (user_id, is_global, country, state, zip_code, validate_title, validate_description, blacklist)
            VALUES ($1, TRUE, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, is_global) WHERE is_global = TRUE
            DO UPDATE SET 
                country = EXCLUDED.country,
                state = EXCLUDED.state,
                zip_code = EXCLUDED.zip_code,
                validate_title = EXCLUDED.validate_title,
                validate_description = EXCLUDED.validate_description,
                blacklist = EXCLUDED.blacklist,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [userId, country, state, zipCode, validateTitle, validateDescription, blacklistJson]);
    } else {
        // Upsert store-specific settings for THIS user
        result = await this.databaseService.query<StoreSettingsEntity>(`
            INSERT INTO store_settings (user_id, store_id, is_global, country, state, zip_code, validate_title, validate_description, blacklist)
            VALUES ($1, $2, FALSE, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, store_id) WHERE store_id IS NOT NULL
            DO UPDATE SET 
                country = EXCLUDED.country,
                state = EXCLUDED.state,
                zip_code = EXCLUDED.zip_code,
                validate_title = EXCLUDED.validate_title,
                validate_description = EXCLUDED.validate_description,
                blacklist = EXCLUDED.blacklist,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [userId, storeId, country, state, zipCode, validateTitle, validateDescription, blacklistJson]);
    }
    
    return this.mapToDto(result[0]);
  }

  /**
   * Map database entity to DTO
   */
  private mapToDto(entity: StoreSettingsEntity): StoreSettingsResponse {
    const blacklist = typeof entity.blacklist === 'string' 
        ? JSON.parse(entity.blacklist) 
        : (entity.blacklist as any as BlacklistKeyword[]);

    return {
      id: entity.id,
      storeId: entity.store_id || undefined,
      isGlobal: entity.is_global,
      country: entity.country,
      state: entity.state,
      zipCode: entity.zip_code,
      validateTitle: entity.validate_title,
      validateDescription: entity.validate_description,
      blacklist: blacklist,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }
}
