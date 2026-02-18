import { Injectable } from '@nestjs/common';

@Injectable()
export class AssistantClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly streamConnectTimeoutMs: number;

  constructor() {
    this.baseUrl = process.env.ASSISTANT_BASE_URL || 'http://localhost:4100';
    this.timeoutMs = Number(process.env.ASSISTANT_HTTP_TIMEOUT_MS || 15000);
    this.streamConnectTimeoutMs = Number(
      process.env.ASSISTANT_STREAM_CONNECT_TIMEOUT_MS || 20000,
    );
  }

  private static toImagePayload(
    images?: Array<{ name: string; dataUrl?: string; url?: string }>,
  ) {
    if (!images) return undefined;
    return images.map((image) => ({
      name: image.name,
      dataUrl: image.dataUrl,
      url: image.url,
    }));
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        (error instanceof Error && error.name === 'AbortError') ||
        message.includes('aborted')
      ) {
        throw new Error(`assistant service timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async answer(
    question: string,
    stats: Record<string, unknown>,
    scope: Record<string, unknown>,
    sessionId?: string,
    thinking?: 'auto' | 'enabled' | 'disabled',
    images?: Array<{ name: string; dataUrl?: string; url?: string }>,
  ) {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/assistant/answer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          stats,
          scope,
          sessionId,
          thinking,
          images: AssistantClient.toImagePayload(images),
        }),
      },
      this.timeoutMs,
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`assistant service failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<{
      answer: string;
      stats: Record<string, unknown>;
      scope: Record<string, unknown>;
      usage?: Record<string, unknown>;
    }>;
  }

  async answerStream(
    question: string,
    stats: Record<string, unknown>,
    scope: Record<string, unknown>,
    sessionId?: string,
    thinking?: 'auto' | 'enabled' | 'disabled',
    images?: Array<{ name: string; dataUrl?: string; url?: string }>,
  ) {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/assistant/answer/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          stats,
          scope,
          sessionId,
          thinking,
          images: AssistantClient.toImagePayload(images),
        }),
      },
      this.streamConnectTimeoutMs,
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`assistant service failed: ${response.status} ${text}`);
    }

    return response.body;
  }
}
