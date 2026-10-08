import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { Customer } from '../customers/customer.entity.js';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl =
    configService.get<string>('DATABASE_URL') ||
    configService.get<string>('DATABASE_PATH');

  const host =
    configService.get<string>('DB_HOST') ||
    'db.ptydkosowocufwwnuins.supabase.co';
  const port = Number(configService.get<number>('DB_PORT') || 5432);
  const username = configService.get<string>('DB_USER') || 'postgres';
  const password =
    configService.get<string>('DB_PASSWORD') || 'Jeonjungkook123@';
  const database = configService.get<string>('DB_NAME') || 'postgres';

  const isRemoteOrSupabase =
    host.includes('supabase.co') ||
    host.includes('render.com') ||
    host.includes('aws') ||
    (databaseUrl && databaseUrl.includes('supabase.co'));

  const sslEnabled =
    configService.get<string>('DB_SSL') === 'true' ||
    configService.get<boolean>('DB_SSL') === true ||
    isRemoteOrSupabase;

  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    entities: [User, RefreshToken, Customer],
    synchronize: true, // Automatically synchronizes entity schema in development
    autoLoadEntities: true,
    logging: configService.get<string>('NODE_ENV') === 'development',
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  };

  // If a full connection URI is provided, use url property
  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    return {
      ...baseConfig,
      url: databaseUrl,
    };
  }

  // Otherwise construct connection from granular environment parameters
  return {
    ...baseConfig,
    host,
    port,
    username,
    password,
    database,
  };
};
