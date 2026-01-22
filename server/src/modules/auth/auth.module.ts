import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// 负责人: 张天齐
// 功能: 登录接口
// 数据存储: PostgreSQL (用户表) + Redis (Session/Token)

@Module({
  controllers: [AuthController],
  providers: [AuthService]
})
export class AuthModule {}
