import { Controller } from '@nestjs/common';
import { AiGradingService } from './ai-grading.service';

@Controller('ai-grading')
export class AiGradingController {
  constructor(private readonly aiGradingService: AiGradingService) {}
}
