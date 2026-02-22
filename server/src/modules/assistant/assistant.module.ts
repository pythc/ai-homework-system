import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantClient } from './assistant.client';
import { AuthModule } from '../auth/auth.module';
import { AssistantTokenUsageEntity } from './entities/assistant-token-usage.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([AssistantTokenUsageEntity]),
  ],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantClient],
})
export class AssistantModule {}
