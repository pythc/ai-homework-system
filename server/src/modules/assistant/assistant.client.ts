import { Injectable } from '@nestjs/common';

@Injectable()
export class AssistantClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.ASSISTANT_BASE_URL || 'http://localhost:4100';
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

  async answer(
    question: string,
    stats: Record<string, unknown>,
    scope: Record<string, unknown>,
    sessionId?: string,
    thinking?: 'auto' | 'enabled' | 'disabled',
    images?: Array<{ name: string; dataUrl?: string; url?: string }>,
  ) {
    const response = await fetch(`${this.baseUrl}/assistant/answer`, {
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
    });

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
    const response = await fetch(`${this.baseUrl}/assistant/answer/stream`, {
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
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`assistant service failed: ${response.status} ${text}`);
    }

    return response.body;
  }
}
