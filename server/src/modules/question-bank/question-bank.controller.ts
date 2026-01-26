import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { QuestionBankService } from './question-bank.service';
import { QuestionBankImportDto } from './dto/question-bank.dto';

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
}
