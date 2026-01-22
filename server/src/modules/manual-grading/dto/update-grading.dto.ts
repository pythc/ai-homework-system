// AI Grading ID 只是用于展示，不需要具体字段
import { GradingUncertaintyCode } from '../../ai-grading/interfaces/ai-grading.interface';

export class UpdateGradingDto {
  source: 'MANUAL' | 'AI_ADOPTED' | 'MIXED';
  totalScore: number;
  finalComment?: string;
  items: {
    questionIndex: number;
    rubricItemKey: string;
    score: number;
    reason?: string;
  }[];
}
