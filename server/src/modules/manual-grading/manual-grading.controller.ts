import { Controller } from '@nestjs/common';
import { ManualGradingService } from './manual-grading.service';

@Controller('manual-grading')
export class ManualGradingController {
  constructor(private readonly manualGradingService: ManualGradingService) {}
}
