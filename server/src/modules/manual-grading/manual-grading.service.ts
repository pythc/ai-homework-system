import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import { UpdateGradingDto } from './dto/update-grading.dto';
import { GraderType, ScoreEntity } from './entities/score.entity';

@Injectable()
export class ManualGradingService {
  constructor(
    @InjectRepository(ScoreEntity)
    private readonly scoreRepo: Repository<ScoreEntity>,
    @InjectRepository(SubmissionVersionEntity)
    private readonly versionRepo: Repository<SubmissionVersionEntity>,
  ) {}

  async submitFinalGrading(submissionVersionId: string, dto: UpdateGradingDto) {
    const version = await this.versionRepo.findOne({
      where: { id: submissionVersionId },
    });
    if (!version) {
      throw new NotFoundException('提交不存在');
    }

    await this.scoreRepo.update(
      { submissionVersionId, isFinal: true },
      { isFinal: false },
    );

    const graderType =
      dto.source === 'AI_ADOPTED' ? GraderType.AI : GraderType.TEACHER;

    const score = this.scoreRepo.create({
      submissionVersionId,
      totalScore: dto.totalScore.toFixed(2),
      scoreDetail: {
        source: dto.source,
        items: dto.items,
        finalComment: dto.finalComment ?? null,
      },
      graderType,
      isFinal: true,
      remark: dto.finalComment ?? null,
    });
    const saved = await this.scoreRepo.save(score);

    return {
      gradingId: saved.id,
      status: 'GRADED',
      totalScore: Number(dto.totalScore),
      updatedAt: saved.updatedAt,
    };
  }

  async getFinalGrading(submissionVersionId: string) {
    const score = await this.scoreRepo.findOne({
      where: { submissionVersionId, isFinal: true },
      order: { createdAt: 'DESC' },
    });
    if (!score) {
      throw new NotFoundException('成绩未生成');
    }
    return {
      gradingId: score.id,
      status: 'GRADED',
      totalScore: Number(score.totalScore),
      updatedAt: score.updatedAt,
    };
  }
}
