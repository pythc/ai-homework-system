import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { QuestionBankService } from './question-bank.service';
import {
  QuestionBankImportDto,
  QuestionBankUpdateDto,
} from './dto/question-bank.dto';

@Controller('question-bank')
export class QuestionBankController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Post('import')
  @UseGuards(JwtAuthGuard)
  async importQuestionBank(
    @Body() body: QuestionBankImportDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      return { code: 401, message: '缺少用户信息' };
    }
    const result = await this.questionBankService.importQuestionBank(
      body,
      userId,
    );
    return {
      code: 201,
      message: '题库导入成功',
      data: result,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('courseId') courseId?: string) {
    return this.questionBankService.findAll(courseId);
  }

  @Get('structure')
  @UseGuards(JwtAuthGuard)
  async getStructure(@Query('courseId') courseId?: string) {
    return this.questionBankService.getStructure(courseId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getQuestion(@Param('id') id: string) {
    return this.questionBankService.getQuestion(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateQuestion(
    @Param('id') id: string,
    @Body() body: QuestionBankUpdateDto,
  ) {
    return this.questionBankService.updateQuestion(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async removeQuestion(@Param('id') id: string) {
    return this.questionBankService.deleteQuestion(id);
  }
}
