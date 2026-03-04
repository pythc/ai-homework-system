import { Module } from '@nestjs/common';
import { PostgresKeyModule } from './common/database/postgres.module';
import { StorageModule } from './common/storage/storage.module';
import { AiGradingWorkerModule } from './modules/ai-grading/ai-grading.worker.module';

@Module({
  imports: [PostgresKeyModule, StorageModule, AiGradingWorkerModule],
})
export class WorkerAppModule {}
