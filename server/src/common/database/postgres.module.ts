import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

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
    }),
  ],
  exports: [TypeOrmModule],
})
export class PostgresKeyModule {}
