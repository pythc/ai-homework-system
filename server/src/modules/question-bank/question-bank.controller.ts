import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  // @UseGuards(JwtAuthGuard) // Toggle if needed
  async findAll(@Query('courseId') courseId: string) {
    if (!courseId) {
      // Return empty or throw error? For now empty list if no courseId
      return []; 
    }
    return this.questionBankService.findAll(courseId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return this.questionBankService.updateQuestion(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.questionBankService.deleteQuestion(id);
  }
}

