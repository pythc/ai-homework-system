export enum GradingUncertaintyCode {
  JUMP_STEP = 'JUMP_STEP',                     // 跳步
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',           // 置信度低
  UNREADABLE = 'UNREADABLE',                   // 无法识别
  STEP_CONFLICT = 'STEP_CONFLICT',             // 步骤冲突
  FINAL_ANSWER_MISMATCH = 'FINAL_ANSWER_MISMATCH', // 答案不匹配
  MISSING_INFO = 'MISSING_INFO',               // 缺少信息
  FORMAT_AMBIGUOUS = 'FORMAT_AMBIGUOUS',       // 格式模糊
}

export interface AiGradingResultItem {
  questionIndex: number;            // 第几题
  rubricItemKey: string;            // 评分细则Key
  score: number;                    // 该项得分
  maxScore: number;                 // 该项满分
  reason: string;                   // 得分理由
  uncertaintyScore?: number;        // 该项不确定度（0~1）
}

export interface AiGrading {
  aiGradingId: string;              // AI批改结果ID
  submissionVersionId: string;      // 学生本次提交版本ID
  assignmentSnapshotId: string;     // 作业题目/答案/rubric的快照ID

  model: {
    name: string;                   // 使用的多模态模型
    version: string;                // 模型版本
  };

  result: {
    comment: string;                // 总体评语
    confidence: number;             // 整体置信度（0~1）

    isUncertain: boolean;           // 是否需要人工复核
    uncertaintyReasons: {
      code: GradingUncertaintyCode | string; // 存疑类型
      message: string;              // 存疑说明
      questionIndex?: number;       // 关联到第几题
    }[];

    items: AiGradingResultItem[];   // 细分项得分
    totalScore: number;             // 总分
  };

  extracted?: {
    studentMarkdown?: string;       // AI识别/转写的学生作答内容
  };

  createdAt: Date;                  // 时间
}
