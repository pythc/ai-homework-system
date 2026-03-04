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
import { memoryStorage } from 'multer';
import { StorageService } from '../../common/storage/storage.service';

@ApiTags('Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly storageService: StorageService,
  ) {}

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
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          cb(new BadRequestException('仅支持图片上传'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadImages(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files?.length) {
      throw new BadRequestException('未选择图片');
    }
    const items = await Promise.all(
      files.map(async (file) => {
        const ref = await this.storageService.persistBuffer(file.buffer, {
          prefix: 'assistant',
          originalName: file.originalname,
          contentType: file.mimetype,
        });
        const url = await this.storageService.resolvePublicUrl(ref);
        return {
          name: file.originalname,
          url,
        };
      }),
    );
    return { files: items };
  }
}
