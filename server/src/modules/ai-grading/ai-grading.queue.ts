import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'redis';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';

@Injectable()
export class AiGradingQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AiGradingQueueService.name);
  private client?: ReturnType<typeof createClient>;
  private workerClient?: ReturnType<typeof createClient>;
  private running = false;
  private stopped = false;
  private readonly queueKey = 'ai_grading_jobs';

  private async getClient(): Promise<ReturnType<typeof createClient>> {
    if (this.client) {
      return this.client;
    }
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url });
    client.on('error', (err) => {
      this.logger.error(`Redis error: ${err}`);
    });
    await client.connect();
    this.client = client;
    return client;
  }

  private async getWorkerClient(): Promise<ReturnType<typeof createClient>> {
    if (this.workerClient) {
      return this.workerClient;
    }
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = createClient({ url });
    client.on('error', (err) => {
      this.logger.error(`Redis worker error: ${err}`);
    });
    await client.connect();
    this.workerClient = client;
    return client;
  }

  async enqueue(jobId: string, payload: TriggerAiGradingDto): Promise<void> {
    const client = await this.getClient();
    await client.set(
      this.payloadKey(jobId),
      JSON.stringify(payload),
      { EX: 24 * 60 * 60 },
    );
    await client.lPush(this.queueKey, jobId);
  }

  async requeue(jobId: string, delayMs: number): Promise<void> {
    const client = await this.getClient();
    if (delayMs <= 0) {
      await client.lPush(this.queueKey, jobId);
      return;
    }
    setTimeout(() => {
      client.lPush(this.queueKey, jobId).catch((error) => {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Requeue failed: ${message}`);
      });
    }, delayMs);
  }

  async getPayload(jobId: string): Promise<TriggerAiGradingDto | null> {
    const client = await this.getClient();
    const raw = await client.get(this.payloadKey(jobId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as TriggerAiGradingDto;
  }

  async clearPayload(jobId: string): Promise<void> {
    const client = await this.getClient();
    await client.del(this.payloadKey(jobId));
  }

  async startWorker(
    handler: (jobId: string) => Promise<void>,
  ): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    this.stopped = false;
    const client = await this.getWorkerClient();
    this.logger.log('AI grading queue worker started.');
    while (!this.stopped) {
      try {
        const result = await client.brPop(this.queueKey, 0);
        if (!result) {
          continue;
        }
        await handler(result.element);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Worker error: ${message}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async stopWorker(): Promise<void> {
    this.stopped = true;
    if (this.client) {
      await this.client.quit();
      this.client = undefined;
    }
    if (this.workerClient) {
      await this.workerClient.quit();
      this.workerClient = undefined;
    }
    this.running = false;
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopWorker();
  }

  private payloadKey(jobId: string): string {
    return `ai_grading:payload:${jobId}`;
  }
}
