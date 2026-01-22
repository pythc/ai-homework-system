import { Injectable } from '@nestjs/common';
import { UpdateGradingDto } from './dto/update-grading.dto';

@Injectable()
export class ManualGradingService {
  async submitFinalGrading(submissionVersionId: string, dto: UpdateGradingDto) {
    // 邓翀宸负责实现: 写入 PostgreSQL 最终成绩表
    return {
      gradingId: "gr_final_mock",
      status: "GRADED",
      totalScore: dto.totalScore,
      updatedAt: new Date()
    };
  }
}
