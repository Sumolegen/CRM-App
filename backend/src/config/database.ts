import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../models/User.entity';
import { RefreshToken } from '../models/RefreshToken.entity';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const host = configService.get<string>('DB_HOST', 'localhost');

  const isRemoteOrSsl =
    (databaseUrl &&
      (databaseUrl.includes('supabase.co') ||
        databaseUrl.includes('pooler.supabase.com'))) ||
    host.includes('supabase.co') ||
    host.includes('pooler.supabase.com') ||
    configService.get<string>('DB_SSL') === 'true' ||
    configService.get<boolean>('DB_SSL') === true;

  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    entities: [User, RefreshToken],
    synchronize: configService.get<string>('NODE_ENV') !== 'production',
    logging: configService.get<string>('NODE_ENV') === 'development',
    ssl: isRemoteOrSsl ? { rejectUnauthorized: false } : false,
  };

  if (
    databaseUrl &&
    (databaseUrl.startsWith('postgres://') ||
      databaseUrl.startsWith('postgresql://'))
  ) {
    return {
      ...baseConfig,
      url: databaseUrl,
    };
  }

  return {
    ...baseConfig,
    host,
    port: Number(configService.get<number>('DB_PORT', 5432)),
    username: configService.get<string>('DB_USER', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_NAME', 'postgres'),
  };
};
