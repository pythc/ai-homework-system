export enum AiJobStatus {
  QUEUED = 'QUEUED',       // 已排队
  RUNNING = 'RUNNING',     // 执行中
  SUCCEEDED = 'SUCCEEDED', // 完成
  FAILED = 'FAILED',       // 失败
}

export enum AiJobStage {
  PREPARE_INPUT = 'PREPARE_INPUT', // 准备输入数据
  CALL_MODEL = 'CALL_MODEL',       // 调用多模态模型
  PARSE_OUTPUT = 'PARSE_OUTPUT',   // 解析模型结果
  SAVE_RESULT = 'SAVE_RESULT',     // 保存结果
}

export interface AiJob {
  aiJobId: string;                 // AI批改任务ID
  submissionVersionId: string;     // 对应的学生提交版本ID
  assignmentSnapshotId?: string;   // 关联作业快照ID
  status: AiJobStatus;             // 当前任务状态
  
  progress?: {
    stage: AiJobStage;             // 当前执行阶段
  };

  error?: any;                     // 失败时返回错误信息
  createdAt: Date;                 // 任务创建时间
  updatedAt: Date;                 // 最近一次状态更新时间
}
