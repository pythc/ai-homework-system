import * as path from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Express, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import {
  RefreshRequestDto,
  RefreshResponseDto,
} from './dto/refresh.dto';
import { LogoutRequestDto, LogoutResponseDto } from './dto/logout.dto';
import { MeResponseDto } from './dto/me.dto';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { ChangePasswordRequestDto, ChangePasswordResponseDto } from './dto/change-password.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { UserRole } from './entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with account credentials.' })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(
    @Body() body: LoginRequestDto,
    @Req() req: Request,
  ) {
    const result = await this.authService.login(body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: body.deviceId,
    });
    return {
      code: 200,
      message: '登录成功',
      data: {
        token: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tokenType: 'Bearer' as const,
          expiresIn: result.expiresIn,
        },
        user: {
          userId: result.user.id,
          role: result.user.role,
          schoolId: result.user.schoolId,
          accountType: result.user.accountType,
          account: result.user.account,
          name: result.user.name ?? null,
          createdAt: result.user.createdAt,
          updatedAt: result.user.updatedAt,
        },
      },
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a user (admin only).' })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async register(@Body() body: RegisterRequestDto) {
    const user = await this.authService.register(body);
    return {
      code: 201,
      message: '注册成功',
      data: {
        userId: user.id,
        schoolId: user.schoolId,
        accountType: user.accountType,
        account: user.account,
        email: user.email ?? null,
        role: user.role,
        status: user.status,
        name: user.name ?? null,
      },
    };
  }

  @Post('register/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async registerBulk(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('请上传Excel文件');
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      throw new BadRequestException('仅支持 .xlsx 或 .xls 文件');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }

    const payload = req.user as { schoolId?: string };
    const schoolId = payload?.schoolId;
    if (!schoolId) {
      throw new BadRequestException('缺少schoolId');
    }

    const result = await this.authService.registerBulkFromExcel(
      file.buffer,
      schoolId,
    );
    return {
      code: 201,
      message: '批量导入完成',
      data: result,
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and return new access token.' })
  @ApiBody({ type: RefreshRequestDto })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  async refresh(
    @Body() body: RefreshRequestDto,
    @Req() req: Request,
  ) {
    const result = await this.authService.refresh(body.refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return {
      code: 200,
      message: '刷新成功',
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      },
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke refresh token.' })
  @ApiBody({ type: LogoutRequestDto })
  @ApiResponse({ status: 200, type: LogoutResponseDto })
  async logout(@Body() body: LogoutRequestDto) {
    await this.authService.logout(body.refreshToken);
    return { code: 200, message: '退出成功' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user info.' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const payload = req.user as { sub: string };
    const user = await this.authService.getUserById(payload.sub);
    if (!user) {
      return {
        code: 404,
        message: '用户不存在',
        data: null,
      };
    }
    return {
      code: 200,
      message: '获取成功',
      data: {
        userId: user.id,
        role: user.role,
        schoolId: user.schoolId,
        accountType: user.accountType,
        account: user.account,
        name: user.name ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  @Patch('password')
  @ApiOperation({ summary: 'Change password for current user.' })
  @ApiBody({ type: ChangePasswordRequestDto })
  @ApiResponse({ status: 200, type: ChangePasswordResponseDto })
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() body: ChangePasswordRequestDto,
    @Req() req: Request,
  ) {
    const payload = req.user as { sub: string };
    await this.authService.changePassword(payload.sub, body);
    return { code: 200, message: '密码修改成功' };
  }
}
