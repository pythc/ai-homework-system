import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionEntity } from './entities/auth-session.entity';
import { UserEntity } from './entities/user.entity';
import { JwtAuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { CourseEntity } from '../assignment/entities/course.entity';

// 负责人: 张天齐
// 功能: 登录接口
// 数据存储: PostgreSQL (用户表) + Redis (Session/Token)

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AuthSessionEntity, CourseEntity])],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
