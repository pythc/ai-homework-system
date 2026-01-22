export class TriggerAiGradingDto {
  /**
   * 快照策略
   * - LATEST_PUBLISHED：取该作业最新已发布快照
   * - SPECIFIC：指定 assignmentSnapshotId
   */
  snapshotPolicy: 'LATEST_PUBLISHED' | 'SPECIFIC';
  
  /**
   * 当 snapshotPolicy=SPECIFIC 时必填
   */
  assignmentSnapshotId?: string;

  /**
   * 模型提示信息
   */
  modelHint?: {
    name: string;
    version: string;
  };

  /**
   * 批改选项
   */
  options?: {
    /** PDF / 多图最多喂给模型的页数上限 */
    maxPages?: number;
    /** PDF 转图的 DPI */
    imageDpi?: number;
    /** 是否让模型额外输出 studentMarkdown */
    returnStudentMarkdown?: boolean;
    /** 建议 0，降低波动 */
    temperature?: number;
  };

  /**
   * 不确定性策略
   */
  uncertaintyPolicy?: {
    /** 如果模型给的 confidence < 阈值，则后端强制 isUncertain=true 并追加原因 */
    minConfidence?: number;
  };
}
