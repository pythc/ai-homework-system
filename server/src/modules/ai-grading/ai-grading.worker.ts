import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiGradingQueueService } from './ai-grading.queue';
import { AiGradingEntity } from './entities/ai-grading.entity';
import { AiJobEntity, AiJobStage, AiJobStatus } from './entities/ai-job.entity';
import { SubmissionVersionEntity, AiStatus, SubmissionStatus } from '../submission/entities/submission-version.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';

const execFileAsync = promisify(execFile);

type SnapshotQuestion = {
  questionId: string;
  questionIndex: number;
  prompt?: { text?: string };
  standardAnswer?: { text?: string };
  rubric?: Array<{ rubricItemKey: string; maxScore: number; criteria: string }>;
};

type ParsedAiOutput = {
  result: Record<string, unknown>;
  extracted?: Record<string, unknown>;
};

@Injectable()
export class AiGradingWorkerService implements OnModuleInit {
  private readonly logger = new Logger(AiGradingWorkerService.name);

  constructor(
    private readonly queue: AiGradingQueueService,
    @InjectRepository(AiJobEntity)
    private readonly jobRepo: Repository<AiJobEntity>,
    @InjectRepository(AiGradingEntity)
    private readonly gradingRepo: Repository<AiGradingEntity>,
    @InjectRepository(SubmissionVersionEntity)
    private readonly submissionVersionRepo: Repository<SubmissionVersionEntity>,
    @InjectRepository(AssignmentSnapshotEntity)
    private readonly snapshotRepo: Repository<AssignmentSnapshotEntity>,
  ) {}

  onModuleInit(): void {
    if (process.env.DISABLE_AI_WORKER === 'true') {
      this.logger.warn('AI grading worker disabled by env.');
      return;
    }
    void this.queue.startWorker((jobId) => this.handleJob(jobId));
  }

  private async handleJob(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      return;
    }
    if (job.status === AiJobStatus.SUCCEEDED) {
      return;
    }
    if (job.status === AiJobStatus.FAILED) {
      return;
    }

    const maxAttempts = this.readNumberEnv('AI_JOB_MAX_ATTEMPTS', 3);
    const timeoutSeconds = this.readNumberEnv('AI_JOB_TIMEOUT_SECONDS', 180);
    const retryDelaySeconds = this.readNumberEnv('AI_JOB_RETRY_DELAY_SECONDS', 5);
    const retryMaxDelaySeconds = this.readNumberEnv('AI_JOB_RETRY_MAX_DELAY_SECONDS', 60);

    const nextAttempt = (job.attempts ?? 0) + 1;
    if (nextAttempt > maxAttempts) {
      await this.markJobFailed(job, '超过最大重试次数');
      return;
    }

    await this.jobRepo.update(
      { id: job.id },
      {
        status: AiJobStatus.RUNNING,
        stage: AiJobStage.PREPARE_INPUT,
        attempts: nextAttempt,
        lastStartedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      },
    );

    try {
      const payload = await this.queue.getPayload(job.id);
      if (!payload) {
        throw new Error('缺少任务参数');
      }

      const submissionVersion = await this.submissionVersionRepo.findOne({
        where: { id: job.submissionVersionId },
      });
      if (!submissionVersion) {
        throw new Error('提交版本不存在');
      }

      const snapshotId = job.assignmentSnapshotId;
      if (!snapshotId) {
        throw new Error('缺少作业快照');
      }
      const snapshot = await this.snapshotRepo.findOne({
        where: { id: snapshotId },
      });
      if (!snapshot) {
        throw new Error('作业快照不存在');
      }

      const question = this.findSnapshotQuestion(
        snapshot.snapshot,
        submissionVersion.questionId,
      );
      if (!question) {
        throw new Error('作业快照中未找到题目');
      }

      await this.jobRepo.update(
        { id: job.id },
        { stage: AiJobStage.CALL_MODEL, updatedAt: new Date() },
      );
      await this.submissionVersionRepo.update(
        { id: submissionVersion.id },
        { status: SubmissionStatus.AI_GRADING, aiStatus: AiStatus.RUNNING, updatedAt: new Date() },
      );

      const result = await this.runModelWithTimeout(
        payload,
        {
          submissionVersionId: submissionVersion.id,
          assignmentSnapshotId: snapshotId,
          studentAnswerText: submissionVersion.contentText ?? '',
          question,
          minConfidence: payload.uncertaintyPolicy?.minConfidence,
          returnStudentMarkdown: payload.options?.returnStudentMarkdown,
        },
        submissionVersion.fileUrl,
        timeoutSeconds * 1000,
      );

      await this.jobRepo.update(
        { id: job.id },
        { stage: AiJobStage.PARSE_OUTPUT, updatedAt: new Date() },
      );

      const parsed = this.parseModelOutput(result.outputText);

      await this.jobRepo.update(
        { id: job.id },
        { stage: AiJobStage.SAVE_RESULT, updatedAt: new Date() },
      );

      const grading = this.gradingRepo.create({
        submissionVersionId: submissionVersion.id,
        assignmentId: submissionVersion.assignmentId,
        assignmentSnapshotId: snapshotId,
        modelName: result.modelName,
        modelVersion: result.modelVersion,
        result: parsed.result,
        extracted: parsed.extracted ?? null,
      });
      await this.gradingRepo.save(grading);

      await this.submissionVersionRepo.update(
        { id: submissionVersion.id },
        { status: SubmissionStatus.AI_FINISHED, aiStatus: AiStatus.SUCCESS, updatedAt: new Date() },
      );

      await this.jobRepo.update(
        { id: job.id },
        { status: AiJobStatus.SUCCEEDED, updatedAt: new Date() },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const delaySeconds = Math.min(
        retryDelaySeconds * Math.pow(2, Math.max(nextAttempt - 1, 0)),
        retryMaxDelaySeconds,
      );
      if (nextAttempt < maxAttempts) {
        await this.jobRepo.update(
          { id: job.id },
          {
            status: AiJobStatus.QUEUED,
            stage: AiJobStage.PREPARE_INPUT,
            error: message,
            updatedAt: new Date(),
          },
        );
        await this.submissionVersionRepo.update(
          { id: job.submissionVersionId },
          { aiStatus: AiStatus.PENDING, updatedAt: new Date() },
        );
        await this.queue.requeue(job.id, delaySeconds * 1000);
        this.logger.warn(`Job ${job.id} retrying in ${delaySeconds}s: ${message}`);
      } else {
        await this.markJobFailed(job, message);
        await this.submissionVersionRepo.update(
          { id: job.submissionVersionId },
          { aiStatus: AiStatus.FAILED, updatedAt: new Date() },
        );
      }
    }
  }

  private async runModelWithTimeout(
    payload: TriggerAiGradingDto,
    input: {
      submissionVersionId: string;
      assignmentSnapshotId: string;
      studentAnswerText: string;
      question: SnapshotQuestion;
      minConfidence?: number;
      returnStudentMarkdown?: boolean;
    },
    fileUrlValue: string,
    timeoutMs: number,
  ) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-grading-'));
    const inputPath = path.join(tempDir, 'input.json');
    const outputPath = path.join(tempDir, 'output.json');

    const jsonPayload = {
      submissionVersionId: input.submissionVersionId,
      assignmentSnapshotId: input.assignmentSnapshotId,
      studentAnswerText: input.studentAnswerText,
        question: {
          questionIndex: input.question.questionIndex,
          prompt: this.extractText(input.question.prompt),
          standardAnswer: this.extractText(input.question.standardAnswer),
          rubric: input.question.rubric ?? [],
      },
      options: {
        returnStudentMarkdown: input.returnStudentMarkdown ?? false,
        minConfidence: input.minConfidence ?? 0.75,
      },
    };

    await fs.writeFile(inputPath, JSON.stringify(jsonPayload, null, 2), 'utf-8');

    const images = await this.collectImagePaths(fileUrlValue);
    const scriptPath = path.resolve(process.cwd(), 'ai_worker', 'grader.py');
    const python = process.env.AI_GRADING_PYTHON || 'python3';

    const args = [
      scriptPath,
      '--json',
      inputPath,
      '--out',
      outputPath,
    ];
    for (const image of images) {
      args.push('--image', image);
    }
    if (payload.modelHint?.name) {
      args.push('--model', payload.modelHint.name);
    }
    if (typeof payload.options?.temperature === 'number') {
      args.push('--temperature', String(payload.options.temperature));
    }

    const modelName = payload.modelHint?.name || process.env.ARK_MODEL || 'unknown';
    const modelVersion = payload.modelHint?.version || null;

    try {
      await execFileAsync(python, args, {
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
        env: process.env,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`模型调用失败: ${message}`);
    }

    const outputText = await fs.readFile(outputPath, 'utf-8');
    return { outputText, modelName, modelVersion };
  }

  private parseModelOutput(raw: string): ParsedAiOutput {
    const trimmed = raw.trim();
    const direct = this.tryParseJson(trimmed);
    if (direct) {
      return this.assertResultShape(direct);
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const candidate = trimmed.slice(start, end + 1);
      const parsed = this.tryParseJson(candidate);
      if (parsed) {
        return this.assertResultShape(parsed);
      }
    }
    throw new Error('模型输出解析失败: 无法解析为 JSON');
  }

  private tryParseJson(text: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      return null;
    }
  }

  private assertResultShape(parsed: Record<string, unknown>): ParsedAiOutput {
    if (!parsed.result || typeof parsed.result !== 'object') {
      throw new Error('模型输出缺少 result 字段');
    }
    const result = parsed.result as Record<string, unknown>;
    const extracted = parsed.extracted;
    if (extracted && typeof extracted !== 'object') {
      throw new Error('模型输出 extracted 字段格式不正确');
    }
    return {
      result,
      extracted: extracted as Record<string, unknown> | undefined,
    };
  }

  private parseFileUrls(value: string): string[] {
    if (!value) {
      return [];
    }
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(String);
        }
      } catch (error) {
        return [value];
      }
    }
    return [value];
  }

  private async collectImagePaths(value: string): Promise<string[]> {
    const maxBytes = this.readNumberEnv('AI_IMAGE_MAX_BYTES', 9 * 1024 * 1024);
    const candidates = this.parseFileUrls(value);
    const kept: string[] = [];
    for (const filePath of candidates) {
      if (kept.length >= 4) {
        break;
      }
      try {
        const stat = await fs.stat(filePath);
        if (stat.size <= maxBytes) {
          kept.push(filePath);
        } else {
          this.logger.warn(
            `Skip image over limit (${stat.size} bytes): ${filePath}`,
          );
        }
      } catch (error) {
        this.logger.warn(`Skip missing image: ${filePath}`);
      }
    }
    return kept;
  }

  private extractText(value?: { text?: string } | string | null): string {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value.text === 'string') {
      return value.text;
    }
    return JSON.stringify(value);
  }

  private findSnapshotQuestion(
    snapshot: Record<string, unknown>,
    questionId: string,
  ): SnapshotQuestion | null {
    const questions = Array.isArray(snapshot?.questions)
      ? (snapshot.questions as SnapshotQuestion[])
      : [];
    return questions.find((item) => item.questionId === questionId) ?? null;
  }

  private async markJobFailed(job: AiJobEntity, message: string) {
    await this.jobRepo.update(
      { id: job.id },
      {
        status: AiJobStatus.FAILED,
        error: message,
        updatedAt: new Date(),
      },
    );
    this.logger.error(`Job ${job.id} failed: ${message}`);
  }

  private readNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }
}
