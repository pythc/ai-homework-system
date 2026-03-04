import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

const readNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// 负责人: 李昌峻 (功能配合表设计) / 白洋 (数据库设计)
// 用途: PostgreSQL 连接配置 - 存储核心业务数据（用户、作业定义、最终成绩）
@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '123456789',
      database: process.env.POSTGRES_DB || 'postgres',
      autoLoadEntities: true,
      synchronize: false,
      migrations: [join(__dirname, '..', '..', 'migrations', '*{.ts,.js}')],
      extra: {
        max: readNumber('PG_POOL_MAX', 30),
        min: readNumber('PG_POOL_MIN', 5),
        idleTimeoutMillis: readNumber('PG_POOL_IDLE_TIMEOUT_MS', 30000),
        connectionTimeoutMillis: readNumber('PG_POOL_CONNECT_TIMEOUT_MS', 5000),
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class PostgresKeyModule {}
