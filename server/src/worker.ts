import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker-app.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  const logger = new Logger('WorkerBootstrap');
  logger.log('AI worker process started');

  const shutdown = async (signal: string) => {
    logger.log(`received ${signal}, closing worker context`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrapWorker();
