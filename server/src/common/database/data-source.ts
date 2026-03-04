import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

const readNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '123456789',
  database: process.env.POSTGRES_DB || 'postgres',
  entities: [join(__dirname, '..', '..', 'modules', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', '..', 'migrations', '*{.ts,.js}')],
  migrationsTransactionMode: 'each',
  synchronize: false,
  extra: {
    max: readNumber('PG_POOL_MAX', 30),
    min: readNumber('PG_POOL_MIN', 5),
    idleTimeoutMillis: readNumber('PG_POOL_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMillis: readNumber('PG_POOL_CONNECT_TIMEOUT_MS', 5000),
  },
});
