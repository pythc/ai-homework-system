import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AiGradingQueueService } from './ai-grading.queue';
import { AiGradingEntity } from './entities/ai-grading.entity';
import { AiJobEntity, AiJobStage, AiJobStatus } from './entities/ai-job.entity';
import { SubmissionVersionEntity, AiStatus, SubmissionStatus } from '../submission/entities/submission-version.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';
import { QuestionType } from '../assignment/entities/assignment-question.entity';

const execFileAsync = promisify(execFile);

type SnapshotQuestion = {
  questionId: string;
  questionIndex: number;
  questionType?: string;
  questionSchema?: Record<string, unknown> | null;
  gradingPolicy?: Record<string, unknown> | null;
  prompt?: { text?: string } | string | Record<string, unknown> | null;
  standardAnswer?: Record<string, unknown> | string | null;
  rubric?: Array<{ rubricItemKey: string; maxScore: number; criteria: string }>;
};

type ParsedAiOutput = {
  result: Record<string, unknown>;
  extracted?: Record<string, unknown>;
};

@Injectable()
export class AiGradingWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiGradingWorkerService.name);
  private staleRecoverTimer?: NodeJS.Timeout;

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
    void this.recoverStaleRunningJobs();
    const recoverIntervalSeconds = this.readNumberEnv(
      'AI_JOB_RECOVER_INTERVAL_SECONDS',
      60,
    );
    this.staleRecoverTimer = setInterval(() => {
      void this.recoverStaleRunningJobs();
    }, Math.max(5, recoverIntervalSeconds) * 1000);
    void this.queue.startWorker((jobId) => this.handleJob(jobId));
  }

  onModuleDestroy(): void {
    if (this.staleRecoverTimer) {
      clearInterval(this.staleRecoverTimer);
      this.staleRecoverTimer = undefined;
    }
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

      let parsed: ParsedAiOutput;
      let modelName = payload.modelHint?.name || process.env.ARK_MODEL || 'unknown';
      let modelVersion: string | null = payload.modelHint?.version || null;

      const gradingMode = this.resolveGradingMode(question);
      if (gradingMode === 'AUTO_RULE') {
        const auto = this.runAutoRuleGrading({
          question,
          studentAnswerText: submissionVersion.contentText ?? '',
          studentAnswerPayload:
            (submissionVersion.answerPayload as Record<string, unknown> | null) ?? null,
          minConfidence: payload.uncertaintyPolicy?.minConfidence,
          returnStudentMarkdown: payload.options?.returnStudentMarkdown,
        });
        parsed = auto.parsed;
        modelName = 'AUTO_RULE';
        modelVersion = auto.modelVersion;
      } else {
        const result = await this.runModelWithTimeout(
          payload,
          {
            submissionVersionId: submissionVersion.id,
            assignmentSnapshotId: snapshotId,
            studentAnswerText: submissionVersion.contentText ?? '',
            studentAnswerPayload:
              (submissionVersion.answerPayload as Record<string, unknown> | null) ?? null,
            answerFormat: submissionVersion.answerFormat ?? null,
            question,
            minConfidence: payload.uncertaintyPolicy?.minConfidence,
            returnStudentMarkdown: payload.options?.returnStudentMarkdown,
            handwritingRecognition: payload.options?.handwritingRecognition,
            gradingStrictness: payload.options?.gradingStrictness,
            customGuidance: payload.options?.customGuidance,
          },
          submissionVersion.fileUrl,
          timeoutSeconds * 1000,
        );
        parsed = this.parseModelOutput(result.outputText);
        modelName = result.modelName;
        modelVersion = result.modelVersion;
      }

      await this.jobRepo.update(
        { id: job.id },
        { stage: AiJobStage.PARSE_OUTPUT, updatedAt: new Date() },
      );

      await this.jobRepo.update(
        { id: job.id },
        { stage: AiJobStage.SAVE_RESULT, updatedAt: new Date() },
      );

      const grading = this.gradingRepo.create({
        submissionVersionId: submissionVersion.id,
        assignmentId: submissionVersion.assignmentId,
        assignmentSnapshotId: snapshotId,
        modelName,
        modelVersion: modelVersion ?? null,
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
      const { message, retryable } = this.classifyJobError(error);
      const delaySeconds = Math.min(
        retryDelaySeconds * Math.pow(2, Math.max(nextAttempt - 1, 0)),
        retryMaxDelaySeconds,
      );
      if (retryable && nextAttempt < maxAttempts) {
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
      studentAnswerPayload?: Record<string, unknown> | null;
      answerFormat?: string | null;
      question: SnapshotQuestion;
      minConfidence?: number;
      returnStudentMarkdown?: boolean;
      handwritingRecognition?: boolean;
      gradingStrictness?: string;
      customGuidance?: string;
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
      studentAnswerPayload: input.studentAnswerPayload ?? null,
      answerFormat: input.answerFormat ?? null,
        question: {
          questionIndex: input.question.questionIndex,
          questionType: input.question.questionType ?? 'SHORT_ANSWER',
          questionSchema: input.question.questionSchema ?? null,
          gradingPolicy: input.question.gradingPolicy ?? null,
          prompt: this.extractText(input.question.prompt),
          standardAnswer: this.extractText(input.question.standardAnswer),
          rubric: input.question.rubric ?? [],
      },
      options: {
        returnStudentMarkdown: input.returnStudentMarkdown ?? false,
        minConfidence: input.minConfidence ?? 0.75,
        handwritingRecognition: input.handwritingRecognition ?? false,
        gradingStrictness: input.gradingStrictness ?? 'BALANCED',
        customGuidance: input.customGuidance ?? '',
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
      try {
        await execFileAsync(python, args, {
          timeout: timeoutMs,
          maxBuffer: 2 * 1024 * 1024,
          env: process.env,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          (error as any)?.code === 'ETIMEDOUT' ||
          message.includes('timed out') ||
          message.includes('timeout')
        ) {
          throw new Error(`模型调用超时(${timeoutMs}ms)`);
        }
        throw new Error(`模型调用失败: ${message}`);
      }

      const outputText = await fs.readFile(outputPath, 'utf-8');
      return { outputText, modelName, modelVersion };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private resolveGradingMode(question: SnapshotQuestion): 'AUTO_RULE' | 'AI_RUBRIC' {
    const policy = question.gradingPolicy;
    const modeRaw =
      policy && typeof policy === 'object' && !Array.isArray(policy)
        ? String((policy as Record<string, unknown>).mode ?? '')
        : '';
    if (modeRaw.toUpperCase() === 'AUTO_RULE') {
      return 'AUTO_RULE';
    }
    const objectiveTypes = new Set<string>([
      QuestionType.SINGLE_CHOICE,
      QuestionType.MULTI_CHOICE,
      QuestionType.JUDGE,
      QuestionType.FILL_BLANK,
    ]);
    const questionType = String(question.questionType ?? QuestionType.SHORT_ANSWER).toUpperCase();
    return objectiveTypes.has(questionType) ? 'AUTO_RULE' : 'AI_RUBRIC';
  }

  private runAutoRuleGrading(input: {
    question: SnapshotQuestion;
    studentAnswerText: string;
    studentAnswerPayload: Record<string, unknown> | null;
    minConfidence?: number;
    returnStudentMarkdown?: boolean;
  }): { parsed: ParsedAiOutput; modelVersion: string } {
    const questionType = String(
      input.question.questionType ?? QuestionType.SHORT_ANSWER,
    ).toUpperCase();
    const questionIndex = Number(input.question.questionIndex ?? 1) || 1;
    const minConfidence = this.clamp01(input.minConfidence ?? 0.75);
    const standard = this.normalizeStructuredAnswer(
      questionType,
      input.question.standardAnswer ?? null,
    );
    const student = this.normalizeStructuredAnswer(
      questionType,
      input.studentAnswerPayload,
      input.studentAnswerText,
    );
    const allowPartial = this.readAllowPartial(input.question.questionSchema);

    const uncertaintyReasons: Array<{ code: string; message: string }> = [];
    if (!standard.hasAnswer) {
      uncertaintyReasons.push({
        code: 'MISSING_INFO',
        message: '标准答案缺少可判分结构，建议教师复核',
      });
    }
    if (!student.hasAnswer) {
      uncertaintyReasons.push({
        code: 'MISSING_INFO',
        message: '学生答案为空或格式无效',
      });
    }

    let scoreRatio = 0;
    let reason = '依据规则完成自动判分';
    if (standard.hasAnswer && student.hasAnswer) {
      const compared = this.compareStructuredAnswer(
        questionType,
        standard.value,
        student.value,
        allowPartial,
      );
      scoreRatio = compared.ratio;
      reason = compared.reason;
      if (compared.uncertain) {
        uncertaintyReasons.push({
          code: 'FORMAT_AMBIGUOUS',
          message: compared.uncertain,
        });
      }
    }

    const rubricItems =
      Array.isArray(input.question.rubric) && input.question.rubric.length
        ? input.question.rubric.map((item, idx) => ({
            rubricItemKey: item.rubricItemKey || `AUTO_${idx + 1}`,
            maxScore: Number(item.maxScore ?? 0),
            criteria: item.criteria ?? '自动判分',
          }))
        : [];
    const fallbackMax =
      this.readNumber(input.question.questionSchema, 'maxScore') ??
      this.readNumber(input.question.questionSchema, 'score') ??
      10;
    const normalizedRubric = rubricItems.length
      ? rubricItems
      : [{ rubricItemKey: 'AUTO_SCORE', maxScore: fallbackMax, criteria: '自动判分' }];
    const totalMax = normalizedRubric.reduce((sum, item) => sum + Math.max(0, item.maxScore), 0);
    const safeRatio = this.clamp01(scoreRatio);
    const itemScores = this.allocateScoresByRatio(normalizedRubric, safeRatio);
    const totalScore = Number(itemScores.reduce((sum, item) => sum + item.score, 0).toFixed(2));

    let confidence = this.estimateAutoConfidence({
      ratio: safeRatio,
      hasStandard: standard.hasAnswer,
      hasStudent: student.hasAnswer,
      hasUncertainReason: uncertaintyReasons.length > 0,
    });
    if (confidence < minConfidence) {
      uncertaintyReasons.push({
        code: 'LOW_CONFIDENCE',
        message: `自动判分置信度 ${confidence.toFixed(2)} 低于阈值 ${minConfidence.toFixed(2)}`,
      });
    }
    confidence = Number(confidence.toFixed(3));
    const isUncertain =
      uncertaintyReasons.length > 0 ||
      confidence < minConfidence ||
      itemScores.some((item) => item.uncertaintyScore >= 0.6);

    const resultItems = itemScores.map((item) => ({
      questionIndex,
      rubricItemKey: item.rubricItemKey,
      score: item.score,
      maxScore: item.maxScore,
      reason,
      uncertaintyScore: item.uncertaintyScore,
    }));

    const parsed: ParsedAiOutput = {
      result: {
        comment: this.buildAutoComment({
          isUncertain,
          reason,
          uncertaintyReasons,
          ratio: safeRatio,
        }),
        confidence,
        isUncertain,
        uncertaintyReasons,
        items: resultItems,
        totalScore,
      },
    };
    if (input.returnStudentMarkdown) {
      parsed.extracted = {
        studentMarkdown: this.formatStudentStructuredMarkdown(
          questionType,
          student.value,
          input.studentAnswerText,
        ),
      };
    }

    return { parsed, modelVersion: 'auto-rule-v1' };
  }

  private normalizeStructuredAnswer(
    questionType: string,
    payload: unknown,
    fallbackText = '',
  ): { hasAnswer: boolean; value: unknown } {
    if (questionType === QuestionType.JUDGE) {
      const bool = this.extractBoolean(payload, fallbackText);
      return { hasAnswer: bool !== null, value: bool };
    }

    if (questionType === QuestionType.SINGLE_CHOICE) {
      const ids = this.extractOptionIds(payload, fallbackText);
      return { hasAnswer: ids.length > 0, value: ids.length ? ids[0] : null };
    }

    if (questionType === QuestionType.MULTI_CHOICE) {
      const ids = this.extractOptionIds(payload, fallbackText);
      const unique = Array.from(new Set(ids));
      return { hasAnswer: unique.length > 0, value: unique };
    }

    if (questionType === QuestionType.FILL_BLANK) {
      const blanks = this.extractBlanks(payload, fallbackText);
      return { hasAnswer: blanks.length > 0, value: blanks };
    }

    if (payload !== null && payload !== undefined) {
      return { hasAnswer: true, value: payload };
    }
    const text = (fallbackText || '').trim();
    return { hasAnswer: Boolean(text), value: text || null };
  }

  private compareStructuredAnswer(
    questionType: string,
    standard: unknown,
    student: unknown,
    allowPartial: boolean,
  ): { ratio: number; reason: string; uncertain?: string } {
    if (questionType === QuestionType.SINGLE_CHOICE) {
      const expected = String(standard ?? '').trim();
      const actual = String(student ?? '').trim();
      const matched = expected && actual && expected === actual;
      return {
        ratio: matched ? 1 : 0,
        reason: matched
          ? `答案匹配（标准答案：${expected}）`
          : `答案不匹配（标准答案：${expected || '未设置'}，学生答案：${actual || '空'}）`,
      };
    }

    if (questionType === QuestionType.JUDGE) {
      const expected = typeof standard === 'boolean' ? standard : null;
      const actual = typeof student === 'boolean' ? student : null;
      if (expected === null || actual === null) {
        return {
          ratio: 0,
          reason: '判断题答案格式异常',
          uncertain: '判断题答案格式异常',
        };
      }
      const matched = expected === actual;
      return {
        ratio: matched ? 1 : 0,
        reason: matched ? '判断结果正确' : `判断结果错误（标准：${expected ? '对' : '错'}）`,
      };
    }

    if (questionType === QuestionType.MULTI_CHOICE) {
      const expected = this.normalizeTokenSet(Array.isArray(standard) ? standard : []);
      const actual = this.normalizeTokenSet(Array.isArray(student) ? student : []);
      if (expected.size === 0) {
        return { ratio: 0, reason: '多选题缺少标准答案', uncertain: '多选题缺少标准答案' };
      }
      const tp = Array.from(actual).filter((item) => expected.has(item)).length;
      const fp = Array.from(actual).filter((item) => !expected.has(item)).length;
      const fn = Array.from(expected).filter((item) => !actual.has(item)).length;
      const exact = fp === 0 && fn === 0;
      if (exact) {
        return { ratio: 1, reason: '选项完全匹配' };
      }
      if (!allowPartial) {
        return { ratio: 0, reason: '多选未完全匹配（该题不允许部分得分）' };
      }
      const denominator = expected.size + fp;
      const ratio = denominator > 0 ? tp / denominator : 0;
      return {
        ratio: this.clamp01(ratio),
        reason: `多选部分匹配（命中 ${tp}，多选 ${fp}，漏选 ${fn}）`,
      };
    }

    if (questionType === QuestionType.FILL_BLANK) {
      const expected = Array.isArray(standard)
        ? standard.map((item) => this.normalizeToken(item))
        : [];
      const actual = Array.isArray(student)
        ? student.map((item) => this.normalizeToken(item))
        : [];
      if (!expected.length) {
        return { ratio: 0, reason: '填空题缺少标准答案', uncertain: '填空题缺少标准答案' };
      }
      let matched = 0;
      expected.forEach((expectedValue, index) => {
        if (expectedValue && expectedValue === (actual[index] ?? '')) {
          matched += 1;
        }
      });
      const exact = matched === expected.length;
      if (exact) {
        return { ratio: 1, reason: '填空答案全部正确' };
      }
      if (!allowPartial) {
        return { ratio: 0, reason: '填空未全部正确（该题不允许部分得分）' };
      }
      return {
        ratio: this.clamp01(matched / expected.length),
        reason: `填空部分匹配（正确 ${matched}/${expected.length}）`,
      };
    }

    return { ratio: 0, reason: '该题型未配置自动判分规则', uncertain: '题型未配置自动判分规则' };
  }

  private extractOptionIds(payload: unknown, fallbackText: string): string[] {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const obj = payload as Record<string, unknown>;
      for (const key of ['selectedOptionIds', 'selectedOptions', 'optionIds', 'options']) {
        const value = obj[key];
        if (Array.isArray(value)) {
          const ids = value
            .map((item) => String(item).trim())
            .filter(Boolean);
          if (ids.length) return ids;
        }
      }
      for (const key of ['selectedOptionId', 'selectedOption', 'optionId', 'value', 'answer']) {
        const value = obj[key];
        if (typeof value === 'string' && value.trim()) {
          return [value.trim()];
        }
      }
    }
    if (typeof payload === 'string' && payload.trim()) {
      return this.splitTokens(payload);
    }
    return this.splitTokens(fallbackText);
  }

  private extractBoolean(payload: unknown, fallbackText: string): boolean | null {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const obj = payload as Record<string, unknown>;
      for (const key of ['value', 'answer', 'isTrue', 'correct']) {
        const parsed = this.parseBoolean(obj[key]);
        if (parsed !== null) return parsed;
      }
    }
    const parsed = this.parseBoolean(payload);
    if (parsed !== null) return parsed;
    return this.parseBoolean(fallbackText);
  }

  private parseBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
      return null;
    }
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', 't', 'yes', 'y', '1', '对', '正确'].includes(normalized)) return true;
    if (['false', 'f', 'no', 'n', '0', '错', '错误'].includes(normalized)) return false;
    return null;
  }

  private extractBlanks(payload: unknown, fallbackText: string): string[] {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const obj = payload as Record<string, unknown>;
      for (const key of ['blanks', 'answers', 'values']) {
        const value = obj[key];
        if (Array.isArray(value)) {
          return value.map((item) => String(item).trim()).filter(Boolean);
        }
      }
      const single = obj.answer;
      if (typeof single === 'string' && single.trim()) {
        return this.splitTokens(single);
      }
    }
    if (typeof payload === 'string' && payload.trim()) {
      return this.splitTokens(payload);
    }
    return this.splitTokens(fallbackText);
  }

  private splitTokens(value: string): string[] {
    if (!value) return [];
    return value
      .split(/[\n,，;；、\s]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeTokenSet(values: unknown[]): Set<string> {
    return new Set(
      values
        .map((item) => this.normalizeToken(item))
        .filter(Boolean),
    );
  }

  private normalizeToken(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  private readAllowPartial(schema?: Record<string, unknown> | null): boolean {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      return true;
    }
    const raw = (schema as Record<string, unknown>).allowPartial;
    if (typeof raw === 'boolean') return raw;
    return true;
  }

  private readNumber(schema: Record<string, unknown> | null | undefined, key: string): number | null {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null;
    const value = Number((schema as Record<string, unknown>)[key]);
    return Number.isFinite(value) ? value : null;
  }

  private allocateScoresByRatio(
    rubricItems: Array<{ rubricItemKey: string; maxScore: number }>,
    ratio: number,
  ) {
    const safeRatio = this.clamp01(ratio);
    const result = rubricItems.map((item) => ({
      rubricItemKey: item.rubricItemKey,
      maxScore: Number(item.maxScore.toFixed(2)),
      score: Number((Math.max(0, item.maxScore) * safeRatio).toFixed(2)),
      uncertaintyScore: Number((1 - safeRatio).toFixed(3)),
    }));
    const maxTotal = Number(result.reduce((sum, item) => sum + item.maxScore, 0).toFixed(2));
    const targetTotal = Number((maxTotal * safeRatio).toFixed(2));
    const currentTotal = Number(result.reduce((sum, item) => sum + item.score, 0).toFixed(2));
    const diff = Number((targetTotal - currentTotal).toFixed(2));
    if (result.length > 0 && Math.abs(diff) > 0) {
      const last = result[result.length - 1];
      last.score = Number(Math.max(0, Math.min(last.maxScore, last.score + diff)).toFixed(2));
    }
    return result;
  }

  private estimateAutoConfidence(input: {
    ratio: number;
    hasStandard: boolean;
    hasStudent: boolean;
    hasUncertainReason: boolean;
  }) {
    if (!input.hasStandard || !input.hasStudent) {
      return 0.25;
    }
    if (input.hasUncertainReason) {
      return 0.58;
    }
    if (input.ratio >= 0.999) {
      return 0.97;
    }
    if (input.ratio >= 0.8) {
      return 0.9;
    }
    if (input.ratio >= 0.5) {
      return 0.82;
    }
    return 0.72;
  }

  private buildAutoComment(input: {
    isUncertain: boolean;
    reason: string;
    uncertaintyReasons: Array<{ code: string; message: string }>;
    ratio: number;
  }) {
    const base = `自动规则判分：${input.reason}。`;
    if (!input.isUncertain) {
      return `${base} 建议教师快速复核后确认成绩。`;
    }
    const reasonText = input.uncertaintyReasons
      .map((item) => `${item.code}:${item.message}`)
      .join('；');
    return `${base} 存在待核验项（${reasonText}），建议教师人工确认。`;
  }

  private formatStudentStructuredMarkdown(
    questionType: string,
    structuredValue: unknown,
    fallbackText: string,
  ) {
    if (questionType === QuestionType.JUDGE && typeof structuredValue === 'boolean') {
      return structuredValue ? '对' : '错';
    }
    if (questionType === QuestionType.SINGLE_CHOICE) {
      const value = String(structuredValue ?? '').trim();
      return value || fallbackText || '[空答案]';
    }
    if (
      (questionType === QuestionType.MULTI_CHOICE || questionType === QuestionType.FILL_BLANK) &&
      Array.isArray(structuredValue)
    ) {
      const values = structuredValue.map((item) => String(item).trim()).filter(Boolean);
      return values.length ? values.join('、') : fallbackText || '[空答案]';
    }
    if (structuredValue && typeof structuredValue === 'object') {
      return JSON.stringify(structuredValue, null, 2);
    }
    return String(structuredValue ?? fallbackText ?? '').trim() || '[空答案]';
  }

  private clamp01(value: number) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
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

  private async recoverStaleRunningJobs() {
    const staleSeconds = this.readNumberEnv('AI_JOB_STALE_SECONDS', 300);
    const cutoff = new Date(Date.now() - staleSeconds * 1000);
    const staleJobs = await this.jobRepo.find({
      where: {
        status: AiJobStatus.RUNNING,
        lastStartedAt: LessThan(cutoff),
      },
      order: { lastStartedAt: 'ASC' },
      take: 100,
    });
    if (!staleJobs.length) {
      return;
    }

    for (const job of staleJobs) {
      await this.jobRepo.update(
        { id: job.id },
        {
          status: AiJobStatus.QUEUED,
          stage: AiJobStage.PREPARE_INPUT,
          error: `Recovered stale RUNNING job at ${new Date().toISOString()}`,
          updatedAt: new Date(),
        },
      );
      await this.submissionVersionRepo.update(
        { id: job.submissionVersionId },
        { aiStatus: AiStatus.PENDING, updatedAt: new Date() },
      );
      await this.queue.requeue(job.id, 0);
    }

    this.logger.warn(`Recovered ${staleJobs.length} stale RUNNING AI jobs.`);
  }

  private classifyJobError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const nonRetryablePatterns: RegExp[] = [
      /缺少任务参数/,
      /提交版本不存在/,
      /缺少作业快照/,
      /作业快照不存在/,
      /作业快照中未找到题目/,
      /模型输出解析失败/,
      /模型输出缺少 result 字段/,
      /模型输出 extracted 字段格式不正确/,
      /unauthorized/i,
      /forbidden/i,
      /invalid api key/i,
      /accessdenied/i,
    ];
    const retryablePatterns: RegExp[] = [
      /timeout/i,
      /timed out/i,
      /ECONNRESET/i,
      /ECONNREFUSED/i,
      /socket hang up/i,
      /5\d\d/,
      /rate limit/i,
      /too many requests/i,
    ];

    if (nonRetryablePatterns.some((pattern) => pattern.test(message))) {
      return { message, retryable: false };
    }
    if (retryablePatterns.some((pattern) => pattern.test(message))) {
      return { message, retryable: true };
    }
    return { message, retryable: true };
  }
}
