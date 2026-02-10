import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Express } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AssistantService } from './assistant.service';
import { AssistantChatDto } from './dto/assistant-chat.dto';
import { UserRole } from '../auth/entities/user.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

@ApiTags('Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Body() dto: AssistantChatDto,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.assistantService.chat(dto, req.user ?? {});
  }

  @Post('chat/stream')
  @UseGuards(JwtAuthGuard)
  async chatStream(
    @Body() dto: AssistantChatDto,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
    @Res() res: Response,
  ) {
    await this.assistantService.chatStream(dto, req.user ?? {}, res);
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async usage(
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.assistantService.getUsageSummary(req.user ?? {});
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 4, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const base = join(process.cwd(), 'uploads', 'assistant');
          if (!existsSync(base)) {
            mkdirSync(base, { recursive: true });
          }
          cb(null, base);
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const safeExt = ext && ext.length <= 10 ? ext : '';
          cb(null, `${randomUUID()}${safeExt}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImages(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files?.length) {
      throw new BadRequestException('未选择图片');
    }
    const items = files.map((file) => ({
      name: file.originalname,
      url: `/uploads/assistant/${file.filename}`,
    }));
    return { files: items };
  }
}
