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
  private readonly redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  private readonly payloadTtlSeconds = this.readNumberEnv(
    'AI_JOB_PAYLOAD_TTL_SECONDS',
    24 * 60 * 60,
  );
  private readonly connectMaxRetries = this.readNumberEnv(
    'REDIS_CONNECT_MAX_RETRIES',
    10,
  );
  private readonly connectBaseDelayMs = this.readNumberEnv(
    'REDIS_CONNECT_BASE_DELAY_MS',
    500,
  );
  private readonly opMaxRetries = this.readNumberEnv('REDIS_OP_MAX_RETRIES', 3);
  private readonly opBaseDelayMs = this.readNumberEnv('REDIS_OP_BASE_DELAY_MS', 200);

  private readNumberEnv(name: string, fallback: number) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildClient(kind: 'default' | 'worker') {
    const client = createClient({
      url: this.redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          const delay = Math.min(this.connectBaseDelayMs * Math.pow(2, retries), 5000);
          this.logger.warn(`[redis:${kind}] reconnect #${retries + 1}, delay=${delay}ms`);
          return delay;
        },
      },
    });
    client.on('error', (err) => {
      this.logger.error(`Redis ${kind} error: ${err}`);
    });
    return client;
  }

  private isRetryableRedisError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('ECONNRESET') ||
      message.includes('ECONNREFUSED') ||
      message.includes('Socket closed') ||
      message.includes('Connection') ||
      message.includes('The client is closed')
    );
  }

  private async connectWithRetry(
    client: ReturnType<typeof createClient>,
    kind: 'default' | 'worker',
  ) {
    for (let attempt = 1; attempt <= this.connectMaxRetries; attempt += 1) {
      try {
        if (!client.isOpen) {
          await client.connect();
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === this.connectMaxRetries) {
          throw new Error(`Redis ${kind} connect failed after ${attempt} tries: ${message}`);
        }
        const delay = Math.min(this.connectBaseDelayMs * Math.pow(2, attempt - 1), 5000);
        this.logger.warn(
          `Redis ${kind} connect retry ${attempt}/${this.connectMaxRetries}: ${message}`,
        );
        await this.sleep(delay);
      }
    }
  }

  private async withRedisRetry<T>(op: () => Promise<T>, label: string): Promise<T> {
    for (let attempt = 1; attempt <= this.opMaxRetries; attempt += 1) {
      try {
        return await op();
      } catch (error) {
        if (attempt === this.opMaxRetries || !this.isRetryableRedisError(error)) {
          throw error;
        }
        const delay = Math.min(this.opBaseDelayMs * Math.pow(2, attempt - 1), 2000);
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Redis op retry ${attempt}/${this.opMaxRetries} for ${label}: ${message}`,
        );
        await this.sleep(delay);
      }
    }
    throw new Error(`Redis op failed: ${label}`);
  }

  private async getClient(): Promise<ReturnType<typeof createClient>> {
    if (this.client?.isOpen) {
      return this.client;
    }
    const client = this.buildClient('default');
    await this.connectWithRetry(client, 'default');
    this.client = client;
    return client;
  }

  private async getWorkerClient(): Promise<ReturnType<typeof createClient>> {
    if (this.workerClient?.isOpen) {
      return this.workerClient;
    }
    const client = this.buildClient('worker');
    await this.connectWithRetry(client, 'worker');
    this.workerClient = client;
    return client;
  }

  async enqueue(jobId: string, payload: TriggerAiGradingDto): Promise<void> {
    const client = await this.getClient();
    await this.withRedisRetry(
      () =>
        client.set(this.payloadKey(jobId), JSON.stringify(payload), {
          EX: this.payloadTtlSeconds,
        }),
      'enqueue:set',
    );
    await this.withRedisRetry(() => client.lPush(this.queueKey, jobId), 'enqueue:lpush');
  }

  async requeue(jobId: string, delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      const client = await this.getClient();
      await this.withRedisRetry(() => client.lPush(this.queueKey, jobId), 'requeue:lpush');
      return;
    }
    setTimeout(async () => {
      try {
        const client = await this.getClient();
        await this.withRedisRetry(() => client.lPush(this.queueKey, jobId), 'requeue:delayed');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Requeue failed: ${message}`);
      }
    }, delayMs);
  }

  async getPayload(jobId: string): Promise<TriggerAiGradingDto | null> {
    const client = await this.getClient();
    const raw = await this.withRedisRetry(() => client.get(this.payloadKey(jobId)), 'getPayload');
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as TriggerAiGradingDto;
  }

  async clearPayload(jobId: string): Promise<void> {
    const client = await this.getClient();
    await this.withRedisRetry(() => client.del(this.payloadKey(jobId)), 'clearPayload');
  }

  async ping(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const pong = await this.withRedisRetry(() => client.ping(), 'ping');
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  async getQueueMetrics() {
    const client = await this.getClient();
    const queueLength = await this.withRedisRetry(() => client.lLen(this.queueKey), 'llen');
    return {
      queueLength,
      redisConnected: client.isOpen,
      workerRedisConnected: Boolean(this.workerClient?.isOpen),
    };
  }

  async startWorker(
    handler: (jobId: string) => Promise<void>,
  ): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    this.stopped = false;
    this.logger.log('AI grading queue worker started.');
    while (!this.stopped) {
      try {
        const client = await this.getWorkerClient();
        const result = await client.brPop(this.queueKey, 0);
        if (!result) {
          continue;
        }
        await handler(result.element);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Worker error: ${message}`);
        if (this.workerClient && !this.workerClient.isOpen) {
          this.workerClient = undefined;
        }
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
