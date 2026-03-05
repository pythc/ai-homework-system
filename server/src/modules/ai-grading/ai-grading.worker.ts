import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AiGradingQueueService } from './ai-grading.queue';
import { AiGradingEntity } from './entities/ai-grading.entity';
import { AiJobEntity, AiJobStage, AiJobStatus } from './entities/ai-job.entity';
import { SubmissionVersionEntity, AiStatus, SubmissionStatus } from '../submission/entities/submission-version.entity';
import { AssignmentSnapshotEntity } from '../assignment/entities/assignment-snapshot.entity';
import { TriggerAiGradingDto } from './dto/trigger-ai-grading.dto';
import { QuestionType } from '../assignment/entities/assignment-question.entity';
import { StorageService } from '../../common/storage/storage.service';

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

type StudentIdentity = {
  studentId: string;
  name: string;
  account: string;
};

type PlagiarismSuspect = {
  submissionVersionId: string;
  studentId: string;
  name: string;
  account: string;
  similarity: number;
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
    private readonly storageService: StorageService,
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
            plagiarismDetection: payload.options?.plagiarismDetection,
            jumpStepDetection: payload.options?.jumpStepDetection,
            stepConflictDetection: payload.options?.stepConflictDetection,
            requiredStepDetection: payload.options?.requiredStepDetection,
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

      this.applyScoreLeniency(parsed.result, {
        gradingMode,
        gradingStrictness: payload.options?.gradingStrictness,
      });
      this.normalizeReasonChannels(parsed.result);

      await this.applyPlagiarismCheck({
        enabled: payload.options?.plagiarismDetection !== false,
        parsed,
        submissionVersion,
        question,
      });

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
      plagiarismDetection?: boolean;
      jumpStepDetection?: boolean;
      stepConflictDetection?: boolean;
      requiredStepDetection?: boolean;
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
        returnStudentMarkdown:
          Boolean(input.returnStudentMarkdown) ||
          Boolean(input.plagiarismDetection) ||
          Boolean(input.handwritingRecognition),
        minConfidence: input.minConfidence ?? 0.75,
        handwritingRecognition: input.handwritingRecognition ?? false,
        plagiarismDetection: input.plagiarismDetection ?? true,
        jumpStepDetection: input.jumpStepDetection ?? true,
        stepConflictDetection: input.stepConflictDetection ?? true,
        requiredStepDetection: input.requiredStepDetection ?? true,
        gradingStrictness: input.gradingStrictness ?? 'BALANCED',
        customGuidance: input.customGuidance ?? '',
      },
    };

    await fs.writeFile(inputPath, JSON.stringify(jsonPayload, null, 2), 'utf-8');

    const images = await this.collectImagePaths(fileUrlValue, tempDir);
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

  private applyScoreLeniency(
    result: Record<string, unknown>,
    input: { gradingMode: 'AUTO_RULE' | 'AI_RUBRIC'; gradingStrictness?: string },
  ) {
    if (input.gradingMode !== 'AI_RUBRIC') {
      return;
    }
    const strictness = String(input.gradingStrictness ?? 'BALANCED')
      .trim()
      .toUpperCase();
    const defaultByStrictness =
      strictness === 'LENIENT' ? 0.18 : strictness === 'STRICT' ? 0.04 : 0.1;
    const configured = this.readNumberEnv(
      'AI_GRADING_DEDUCTION_RELAX_RATIO',
      defaultByStrictness,
    );
    const relaxRatio = this.clamp01(configured);
    if (relaxRatio <= 0) {
      return;
    }
    const items = Array.isArray(result.items) ? (result.items as Record<string, unknown>[]) : [];
    if (!items.length) {
      return;
    }
    let total = 0;
    for (const item of items) {
      const maxScore = Number(item.maxScore);
      const score = Number(item.score);
      if (!Number.isFinite(maxScore) || !Number.isFinite(score) || maxScore <= 0) {
        if (Number.isFinite(score)) {
          total += score;
        }
        continue;
      }
      const clampedScore = Math.max(0, Math.min(maxScore, score));
      const deduction = maxScore - clampedScore;
      const adjustedScore = Number(
        Math.max(0, Math.min(maxScore, clampedScore + deduction * relaxRatio)).toFixed(2),
      );
      item.score = adjustedScore;
      total += adjustedScore;
    }
    result.totalScore = Number(total.toFixed(2));
  }

  private normalizeReasonChannels(result: Record<string, unknown>) {
    const rawReasons = Array.isArray(result.uncertaintyReasons)
      ? (result.uncertaintyReasons as Array<{ code?: string; message?: string }>)
      : [];
    if (!rawReasons.length) {
      return;
    }

    const kept: Array<{ code: string; message: string }> = [];
    const migrated: Array<{ code: string; message: string }> = [];

    for (const item of rawReasons) {
      const normalized = this.normalizeReasonRecord(item);
      if (!normalized) {
        continue;
      }
      const channel = this.resolveReasonChannel(normalized.code, normalized.message);
      if (channel === 'penalty') {
        migrated.push(normalized);
        continue;
      }
      kept.push(normalized);
    }

    if (migrated.length) {
      this.appendPenaltyReasonsToItems(result, migrated);
    }

    result.uncertaintyReasons = kept;
    const hasObjectionReasons = kept.some((reason) =>
      this.isObjectionReason(reason.code, reason.message),
    );
    const hasUncertaintyReasons = kept.some(
      (reason) => !this.isObjectionReason(reason.code, reason.message),
    );
    result.isUncertain = hasObjectionReasons || hasUncertaintyReasons;
  }

  private normalizeReasonRecord(item?: { code?: string; message?: string }) {
    const rawCode = String(item?.code ?? '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    const code = this.normalizeReasonCode(rawCode);
    const message = String(item?.message ?? '').trim();
    if (!code && !message) {
      return null;
    }
    return {
      code: code || 'UNKNOWN',
      message: message || '模型返回不确定原因',
    };
  }

  private normalizeReasonCode(code: string) {
    switch (code) {
      case 'REQUIRED_STEP_MISSING':
      case 'REQUIRED_STEPS_MISSING':
      case 'MISSING_REQUIRED_STEP':
      case 'MISSING_REQUIRED_STEPS':
      case 'STEP_MISSING':
      case 'STEP_MISSING_REQUIRED':
        return 'MISSING_INFO';
      default:
        return code;
    }
  }

  private resolveReasonChannel(code: string, message: string): 'penalty' | 'objection' | 'uncertainty' {
    if (this.isObjectionReason(code, message)) {
      return 'objection';
    }
    if (this.isPenaltyReason(code, message)) {
      return 'penalty';
    }
    return 'uncertainty';
  }

  private isObjectionReason(code: string, message: string) {
    const normalizedCode = this.normalizeReasonCode(String(code || '').toUpperCase());
    if (normalizedCode === 'PLAGIARISM_RISK' || normalizedCode === 'NON_HANDWRITTEN') {
      return true;
    }
    return /(抄袭|模板化作答|非手写|机打|印刷体|电子排版)/.test(message);
  }

  private isPenaltyReason(code: string, message: string) {
    const normalizedCode = this.normalizeReasonCode(String(code || '').toUpperCase());
    if (
      normalizedCode === 'JUMP_STEP' ||
      normalizedCode === 'STEP_CONFLICT' ||
      normalizedCode === 'MISSING_INFO'
    ) {
      return true;
    }
    return /(跳步|步骤矛盾|矛盾点|缺少必要步骤|缺失必要步骤|必要步骤缺失|缺少关键步骤|跳过了?.*关键步骤)/.test(
      message,
    );
  }

  private appendPenaltyReasonsToItems(
    result: Record<string, unknown>,
    migratedReasons: Array<{ code: string; message: string }>,
  ) {
    const reasonText = migratedReasons
      .map((item) => `${this.humanizeReasonCode(item.code)}：${item.message}`)
      .join('；');
    if (!reasonText) {
      return;
    }
    const suffix = `扣分依据：${reasonText}`;
    const items = Array.isArray(result.items) ? (result.items as Array<Record<string, unknown>>) : [];
    if (items.length) {
      let targetIndex = 0;
      let maxDeduction = -1;
      items.forEach((item, index) => {
        const maxScore = Number(item.maxScore);
        const score = Number(item.score);
        if (!Number.isFinite(maxScore) || !Number.isFinite(score)) {
          return;
        }
        const deduction = maxScore - score;
        if (deduction > maxDeduction) {
          maxDeduction = deduction;
          targetIndex = index;
        }
      });
      const target = items[targetIndex] ?? items[0];
      const currentReason = String(target.reason ?? '').trim();
      if (!currentReason.includes('扣分依据：')) {
        target.reason = currentReason ? `${currentReason}；${suffix}` : suffix;
      } else if (!currentReason.includes(reasonText)) {
        target.reason = `${currentReason}；${reasonText}`;
      }
      return;
    }
    const comment = String(result.comment ?? '').trim();
    if (!comment.includes('扣分依据：')) {
      result.comment = comment ? `${comment}\n\n${suffix}` : suffix;
    } else if (!comment.includes(reasonText)) {
      result.comment = `${comment}\n${reasonText}`;
    }
  }

  private humanizeReasonCode(code: string) {
    switch (code) {
      case 'JUMP_STEP':
        return '跳步';
      case 'STEP_CONFLICT':
        return '步骤矛盾';
      case 'MISSING_INFO':
      case 'REQUIRED_STEP_MISSING':
      case 'MISSING_REQUIRED_STEP':
        return '缺少必要步骤';
      default:
        return code || '扣分原因';
    }
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

  private async applyPlagiarismCheck(input: {
    enabled: boolean;
    parsed: ParsedAiOutput;
    submissionVersion: SubmissionVersionEntity;
    question: SnapshotQuestion;
  }) {
    if (!input.enabled) {
      return;
    }
    if (!this.shouldRunPlagiarismCheck(input.question)) {
      this.setPlagiarismCheckMeta(input.parsed.result, {
        enabled: true,
        flagged: false,
        mode: 'text',
        comparedCount: 0,
        matchedCount: 0,
        threshold: null,
        topSimilarity: 0,
        reason: '当前题型不参与抄袭比对',
      });
      return;
    }

    const minTextLength = Math.max(
      8,
      this.readNumberEnv('AI_PLAGIARISM_MIN_TEXT_LENGTH', 24),
    );
    const textThreshold = this.clamp01(
      this.readNumberEnv('AI_PLAGIARISM_SIMILARITY_THRESHOLD', 0.88),
    );
    const imageThreshold = this.clamp01(
      this.readNumberEnv('AI_PLAGIARISM_IMAGE_SIMILARITY_THRESHOLD', 1),
    );
    const compareLimit = Math.max(
      20,
      Math.floor(this.readNumberEnv('AI_PLAGIARISM_COMPARE_LIMIT', 200)),
    );

    const extractedMarkdown = this.extractStudentMarkdown(
      input.parsed.extracted,
    );
    const baseTextRaw = this.extractComparableAnswerText(
      input.submissionVersion.contentText,
      input.submissionVersion.answerPayload,
      extractedMarkdown,
    );
    const baseText = this.normalizeSimilarityText(baseTextRaw);
    let mode: 'text' | 'image' = 'text';
    let threshold = textThreshold;
    let baseImageHashes: Set<string> | null = null;
    if (baseText.length < minTextLength) {
      mode = 'image';
      threshold = imageThreshold;
      baseImageHashes = await this.extractImageHashes(
        input.submissionVersion.fileUrl,
      );
      if (!baseImageHashes.size) {
        this.setPlagiarismCheckMeta(input.parsed.result, {
          enabled: true,
          flagged: false,
          mode,
          comparedCount: 0,
          matchedCount: 0,
          threshold,
          topSimilarity: 0,
          reason: '当前提交缺少可比对文本，且图片无法提取有效指纹',
        });
        return;
      }
    }

    try {
      const effectiveLimit =
        mode === 'image' ? Math.min(compareLimit, 40) : compareLimit;
      const rows = await this.submissionVersionRepo.query(
        `
          SELECT DISTINCT ON (sv.student_id)
            sv.id,
            sv.student_id AS "studentId",
            u.name AS "studentName",
            u.account AS "studentAccount",
            sv.content_text AS "contentText",
            sv.answer_payload AS "answerPayload",
            sv.file_url AS "fileUrl",
            ag.extracted->>'studentMarkdown' AS "studentMarkdown"
          FROM submission_versions sv
          LEFT JOIN users u ON u.id = sv.student_id
          LEFT JOIN LATERAL (
            SELECT extracted
            FROM ai_gradings
            WHERE submission_version_id = sv.id
            ORDER BY created_at DESC
            LIMIT 1
          ) ag ON true
          WHERE sv.assignment_id = $1
            AND sv.question_id = $2
            AND sv.id <> $3
            AND sv.status <> 'INVALID'
          ORDER BY sv.student_id, sv.submit_no DESC, sv.submitted_at DESC
          LIMIT ${effectiveLimit}
        `,
        [
          input.submissionVersion.assignmentId,
          input.submissionVersion.questionId,
          input.submissionVersion.id,
        ],
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return;
      }

      let comparedCount = 0;
      let matchedCount = 0;
      let topSimilarity = 0;
      const suspects: PlagiarismSuspect[] = [];

      for (const row of rows) {
        let similarity = 0;
        if (mode === 'text') {
          const candidateRaw = this.extractComparableAnswerText(
            row?.contentText,
            row?.answerPayload,
            row?.studentMarkdown,
          );
          const candidate = this.normalizeSimilarityText(candidateRaw);
          if (candidate.length < minTextLength) {
            continue;
          }
          similarity = this.computeTextSimilarity(baseText, candidate);
        } else {
          const candidateHashes = await this.extractImageHashes(
            String(row?.fileUrl ?? ''),
          );
          if (!candidateHashes.size || !baseImageHashes) {
            continue;
          }
          similarity = this.computeSetSimilarity(baseImageHashes, candidateHashes);
        }
        comparedCount += 1;
        if (similarity > topSimilarity) {
          topSimilarity = similarity;
        }
        if (similarity >= threshold) {
          matchedCount += 1;
          suspects.push({
            submissionVersionId: String(row?.id ?? ''),
            studentId: String(row?.studentId ?? ''),
            name: String(row?.studentName ?? '').trim(),
            account: String(row?.studentAccount ?? '').trim(),
            similarity: Number(similarity.toFixed(6)),
          });
        }
      }

      const rankedSuspects = suspects
        .filter((item) => item.submissionVersionId && item.studentId)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 20);

      if (!comparedCount) {
        this.setPlagiarismCheckMeta(input.parsed.result, {
          enabled: true,
          flagged: false,
          mode,
          comparedCount: 0,
          matchedCount: 0,
          threshold,
          topSimilarity: 0,
          reason: '暂无可比对样本，抄袭检查未触发风险判定',
          suspects: [],
        });
        return;
      }

      if (!matchedCount) {
        this.setPlagiarismCheckMeta(input.parsed.result, {
          enabled: true,
          flagged: false,
          mode,
          comparedCount,
          matchedCount: 0,
          threshold,
          topSimilarity,
          reason: '已执行抄袭检查，未发现超过阈值的高相似作答',
          suspects: [],
        });
        return;
      }

      const currentStudent =
        (await this.loadStudentIdentity(input.submissionVersion.studentId)) ?? {
          studentId: input.submissionVersion.studentId,
          name: '',
          account: '',
        };
      this.injectPlagiarismRisk(input.parsed.result, {
        mode,
        threshold,
        topSimilarity,
        matchedCount,
        comparedCount,
        suspects: rankedSuspects,
        relatedStudent: currentStudent,
      });
      await this.markSuspectedPeersAsUncertain({
        suspects: rankedSuspects,
        mode,
        threshold,
        relatedStudent: currentStudent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Plagiarism check skipped: ${message}`);
    }
  }

  private setPlagiarismCheckMeta(
    result: Record<string, unknown>,
    input: {
      enabled: boolean;
      flagged: boolean;
      mode: 'text' | 'image';
      comparedCount: number;
      matchedCount: number;
      threshold: number | null;
      topSimilarity: number;
      reason?: string;
      suspects?: Array<{
        studentId: string;
        name: string;
        account: string;
        similarity: number;
      }>;
    },
  ) {
    result.plagiarismCheck = {
      enabled: input.enabled,
      flagged: input.flagged,
      mode: input.mode,
      comparedCount: input.comparedCount,
      matchedCount: input.matchedCount,
      threshold:
        input.threshold === null ? null : Number(input.threshold.toFixed(3)),
      topSimilarity: Number(input.topSimilarity.toFixed(3)),
      reason: input.reason ?? '',
      suspects: input.suspects ?? [],
    };
  }

  private shouldRunPlagiarismCheck(question: SnapshotQuestion) {
    const type = String(question.questionType ?? QuestionType.SHORT_ANSWER).toUpperCase();
    const objectiveTypes = new Set([
      QuestionType.SINGLE_CHOICE,
      QuestionType.MULTI_CHOICE,
      QuestionType.JUDGE,
      QuestionType.FILL_BLANK,
    ]);
    return !objectiveTypes.has(type as QuestionType);
  }

  private extractComparableAnswerText(
    contentText?: string | null,
    answerPayload?: Record<string, unknown> | null,
    extractedStudentMarkdown?: string | null,
  ) {
    const plainText = String(contentText ?? '').trim();
    const markdownText = String(extractedStudentMarkdown ?? '').trim();
    let payloadText = '';
    if (answerPayload && typeof answerPayload === 'object') {
      const chunks: string[] = [];
      this.collectPrimitiveValues(answerPayload, chunks, 0);
      payloadText = chunks.join(' ').trim();
    }
    const best = [plainText, markdownText, payloadText].sort(
      (a, b) => b.length - a.length,
    )[0];
    return best ? best.slice(0, 8000) : '';
  }

  private extractStudentMarkdown(
    extracted?: Record<string, unknown> | null,
  ) {
    if (!extracted || typeof extracted !== 'object') {
      return '';
    }
    const raw = (extracted as Record<string, unknown>).studentMarkdown;
    return typeof raw === 'string' ? raw : '';
  }

  private collectPrimitiveValues(value: unknown, output: string[], depth: number) {
    if (depth > 4 || output.length >= 300) {
      return;
    }
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        output.push(trimmed);
      }
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      output.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectPrimitiveValues(item, output, depth + 1);
      }
      return;
    }
    if (typeof value === 'object') {
      for (const item of Object.values(value as Record<string, unknown>)) {
        this.collectPrimitiveValues(item, output, depth + 1);
      }
    }
  }

  private normalizeSimilarityText(input: string) {
    return String(input || '')
      .toLowerCase()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .slice(0, 12000);
  }

  private computeTextSimilarity(textA: string, textB: string) {
    if (!textA || !textB) {
      return 0;
    }
    if (textA === textB) {
      return 1;
    }
    const ngramN = textA.length < 80 || textB.length < 80 ? 2 : 3;
    const gramsA = this.buildNgramSet(textA, ngramN);
    const gramsB = this.buildNgramSet(textB, ngramN);
    if (!gramsA.size || !gramsB.size) {
      return 0;
    }
    let intersection = 0;
    for (const gram of gramsA) {
      if (gramsB.has(gram)) {
        intersection += 1;
      }
    }
    const union = gramsA.size + gramsB.size - intersection;
    if (union <= 0) {
      return 0;
    }
    return intersection / union;
  }

  private computeSetSimilarity(setA: Set<string>, setB: Set<string>) {
    if (!setA.size || !setB.size) {
      return 0;
    }
    let intersection = 0;
    for (const value of setA) {
      if (setB.has(value)) {
        intersection += 1;
      }
    }
    const union = setA.size + setB.size - intersection;
    if (union <= 0) {
      return 0;
    }
    return intersection / union;
  }

  private buildNgramSet(text: string, n: number) {
    const gramLength = Math.max(1, Math.floor(n));
    if (text.length <= gramLength) {
      return new Set([text]);
    }
    const grams = new Set<string>();
    for (let i = 0; i <= text.length - gramLength; i += 1) {
      grams.add(text.slice(i, i + gramLength));
    }
    return grams;
  }

  private injectPlagiarismRisk(
    result: Record<string, unknown>,
    stats: {
      mode: 'text' | 'image';
      threshold: number;
      topSimilarity: number;
      matchedCount: number;
      comparedCount: number;
      suspects: PlagiarismSuspect[];
      relatedStudent?: StudentIdentity;
    },
  ) {
    const suspectLabel = this.buildSuspectSummary(stats.suspects);
    const reasonMessage = `检测到疑似抄袭：与 ${suspectLabel} 的同题作答高度相似（基于${stats.mode === 'image' ? '图片指纹' : '文本比对'}，最高 ${(stats.topSimilarity * 100).toFixed(1)}%）`;
    const reasons = Array.isArray(result.uncertaintyReasons)
      ? (result.uncertaintyReasons as Array<{ code?: string; message?: string }>)
      : [];
    const hasPlagiarismReason = reasons.some(
      (item) => String(item?.code || '').toUpperCase() === 'PLAGIARISM_RISK',
    );
    if (!hasPlagiarismReason) {
      reasons.push({
        code: 'PLAGIARISM_RISK',
        message: reasonMessage,
      });
    }
    result.uncertaintyReasons = reasons;
    result.isUncertain = true;

    const currentConfidence = Number(result.confidence);
    if (Number.isFinite(currentConfidence)) {
      result.confidence = Number(Math.min(currentConfidence, 0.6).toFixed(3));
    }

    const suffix = `存在疑似抄袭风险（${stats.mode === 'image' ? '图片指纹' : '文本'}比对 ${stats.comparedCount} 份作答，命中 ${stats.matchedCount} 份，最高相似度 ${(stats.topSimilarity * 100).toFixed(1)}%，疑似对象：${suspectLabel}），建议教师复核。`;
    const currentComment = String(result.comment ?? '').trim();
    result.comment = currentComment.includes('疑似抄袭风险')
      ? currentComment
      : currentComment
        ? `${currentComment}\n\n${suffix}`
        : suffix;
    this.setPlagiarismCheckMeta(result, {
      enabled: true,
      flagged: true,
      mode: stats.mode,
      comparedCount: stats.comparedCount,
      matchedCount: stats.matchedCount,
      threshold: stats.threshold,
      topSimilarity: stats.topSimilarity,
      reason: '命中抄袭风险阈值',
      suspects: stats.suspects.map((item) => ({
        studentId: item.studentId,
        name: item.name,
        account: item.account,
        similarity: item.similarity,
      })),
    });
  }

  private buildSuspectSummary(suspects: PlagiarismSuspect[]) {
    if (!suspects.length) {
      return '其他同学';
    }
    const labels = suspects
      .slice(0, 3)
      .map((item) => this.formatStudentIdentity(item))
      .filter(Boolean);
    if (!labels.length) {
      return `${suspects.length}名同学`;
    }
    if (suspects.length > 3) {
      return `${labels.join('、')} 等${suspects.length}人`;
    }
    return labels.join('、');
  }

  private formatStudentIdentity(input: {
    name?: string | null;
    account?: string | null;
    studentId?: string | null;
  }) {
    const name = String(input.name ?? '').trim();
    const account = String(input.account ?? '').trim();
    const studentId = String(input.studentId ?? '').trim();
    const idPart = account || studentId;
    if (name && idPart) {
      return `${name}（${idPart}）`;
    }
    return name || idPart || '未知学生';
  }

  private async loadStudentIdentity(studentId: string): Promise<StudentIdentity | null> {
    if (!studentId) {
      return null;
    }
    const rows = await this.submissionVersionRepo.query(
      `
        SELECT u.id AS "studentId", u.name AS "name", u.account AS "account"
        FROM users u
        WHERE u.id = $1
        LIMIT 1
      `,
      [studentId],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.studentId) {
      return null;
    }
    return {
      studentId: String(row.studentId),
      name: String(row.name ?? '').trim(),
      account: String(row.account ?? '').trim(),
    };
  }

  private async markSuspectedPeersAsUncertain(input: {
    suspects: PlagiarismSuspect[];
    mode: 'text' | 'image';
    threshold: number;
    relatedStudent: StudentIdentity;
  }) {
    const targetVersionIds = Array.from(
      new Set(input.suspects.map((item) => item.submissionVersionId).filter(Boolean)),
    );
    if (!targetVersionIds.length) {
      return;
    }

    const gradingRows = await this.gradingRepo.query(
      `
        SELECT DISTINCT ON (ag.submission_version_id)
          ag.id,
          ag.submission_version_id AS "submissionVersionId",
          ag.result
        FROM ai_gradings ag
        WHERE ag.submission_version_id = ANY($1::uuid[])
        ORDER BY ag.submission_version_id, ag.created_at DESC
      `,
      [targetVersionIds],
    );

    const gradingBySubmissionVersionId = new Map<string, any>();
    if (Array.isArray(gradingRows)) {
      gradingRows.forEach((row) => {
        gradingBySubmissionVersionId.set(String(row?.submissionVersionId ?? ''), row);
      });
    }

    for (const suspect of input.suspects) {
      const gradingRow = gradingBySubmissionVersionId.get(suspect.submissionVersionId);
      if (!gradingRow?.id) {
        continue;
      }
      const rawResult =
        gradingRow.result && typeof gradingRow.result === 'object'
          ? (gradingRow.result as Record<string, unknown>)
          : {};
      const nextResult: Record<string, unknown> = {
        ...rawResult,
      };
      this.markPeerResultAsPlagiarismRisk(nextResult, {
        mode: input.mode,
        threshold: input.threshold,
        similarity: suspect.similarity,
        relatedStudent: input.relatedStudent,
      });
      await this.gradingRepo.update(
        { id: String(gradingRow.id) },
        {
          result: nextResult,
          updatedAt: new Date(),
        },
      );
    }
  }

  private markPeerResultAsPlagiarismRisk(
    result: Record<string, unknown>,
    input: {
      mode: 'text' | 'image';
      threshold: number;
      similarity: number;
      relatedStudent: StudentIdentity;
    },
  ) {
    const relatedLabel = this.formatStudentIdentity(input.relatedStudent);
    const reasonMessage = `检测到与 ${relatedLabel} 的同题作答高度相似（基于${input.mode === 'image' ? '图片指纹' : '文本比对'}，相似度 ${(input.similarity * 100).toFixed(1)}%）`;

    const reasons = Array.isArray(result.uncertaintyReasons)
      ? (result.uncertaintyReasons as Array<{ code?: string; message?: string }>)
      : [];
    const plagiarismReason = reasons.find(
      (item) => String(item?.code || '').toUpperCase() === 'PLAGIARISM_RISK',
    );
    if (plagiarismReason) {
      const existing = String(plagiarismReason.message ?? '');
      if (!existing.includes(relatedLabel)) {
        plagiarismReason.message = existing
          ? `${existing}；关联对象：${relatedLabel}`
          : reasonMessage;
      }
    } else {
      reasons.push({
        code: 'PLAGIARISM_RISK',
        message: reasonMessage,
      });
    }
    result.uncertaintyReasons = reasons;
    result.isUncertain = true;

    const currentConfidence = Number(result.confidence);
    if (Number.isFinite(currentConfidence)) {
      result.confidence = Number(Math.min(currentConfidence, 0.6).toFixed(3));
    }

    const suffix = `存在疑似抄袭风险，关联对象：${relatedLabel}（相似度 ${(input.similarity * 100).toFixed(1)}%），建议教师复核。`;
    const currentComment = String(result.comment ?? '').trim();
    result.comment = currentComment.includes(relatedLabel)
      ? currentComment
      : currentComment
        ? `${currentComment}\n\n${suffix}`
        : suffix;

    this.setPlagiarismCheckMeta(result, {
      enabled: true,
      flagged: true,
      mode: input.mode,
      comparedCount: 1,
      matchedCount: 1,
      threshold: input.threshold,
      topSimilarity: input.similarity,
      reason: '命中抄袭风险阈值',
      suspects: [
        {
          studentId: input.relatedStudent.studentId,
          name: input.relatedStudent.name,
          account: input.relatedStudent.account,
          similarity: Number(input.similarity.toFixed(6)),
        },
      ],
    });
  }

  private async extractImageHashes(fileUrlValue: string): Promise<Set<string>> {
    const refs = this.parseFileUrls(fileUrlValue).slice(0, 4);
    if (!refs.length) {
      return new Set();
    }
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-plag-img-'));
    const hashes = new Set<string>();
    try {
      for (const ref of refs) {
        try {
          const materialized = await this.storageService.materializeForProcessing(
            ref,
            tempDir,
          );
          if (!materialized) {
            continue;
          }
          const buffer = await fs.readFile(materialized.filePath);
          const digest = createHash('sha256').update(buffer).digest('hex');
          hashes.add(digest);
        } catch {
          continue;
        }
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
    return hashes;
  }

  private async collectImagePaths(value: string, tempDir: string): Promise<string[]> {
    const maxBytes = this.readNumberEnv('AI_IMAGE_MAX_BYTES', 9 * 1024 * 1024);
    const candidates = this.parseFileUrls(value);
    const kept: string[] = [];
    for (const fileRef of candidates) {
      if (kept.length >= 4) {
        break;
      }
      try {
        const materialized = await this.storageService.materializeForProcessing(
          fileRef,
          tempDir,
        );
        if (!materialized) {
          this.logger.warn(`Skip missing image: ${fileRef}`);
          continue;
        }
        const filePath = materialized.filePath;
        const stat = await fs.stat(filePath);
        if (stat.size <= maxBytes) {
          kept.push(filePath);
        } else {
          this.logger.warn(
            `Skip image over limit (${stat.size} bytes): ${filePath}`,
          );
        }
      } catch (error) {
        this.logger.warn(`Skip invalid image ref: ${fileRef}`);
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
