import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';
import { ImportQuestionBankDto, QuestionDto } from './dto/import-question-bank.dto';

@Controller('question-bank')
export class QuestionBankController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Post('import')
  async import(@Body() dto: ImportQuestionBankDto) {
    return await this.questionBankService.importQuestionBank(dto);
  }

  @Get()
  async findAll() {
    return this.questionBankService.findAll();
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: Partial<QuestionDto>) {
    return this.questionBankService.updateQuestion(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.questionBankService.deleteQuestion(id);
  }
}
