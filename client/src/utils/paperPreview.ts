export type PaperPreviewItem = {
  key: string
  questionType: string
  title: string
  promptHtml: string
  answerHtml: string
  source: 'bank' | 'custom'
}

const questionTypeLabels: Record<string, string> = {
  SINGLE_CHOICE: '单选题',
  MULTI_CHOICE: '多选题',
  FILL_BLANK: '填空题',
  JUDGE: '判断题',
  SHORT_ANSWER: '简答题',
  ESSAY: '论述题',
  CALCULATION: '计算题',
  PROOF: '证明题',
}

const hasHtmlTag = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const formatRichText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return ''
    if (hasHtmlTag(text)) return text
    return escapeHtml(text).replace(/\n/g, '<br />')
  }
  if (typeof value === 'object') {
    const maybe = value as Record<string, unknown>
    if (typeof maybe.text === 'string') {
      return formatRichText(maybe.text)
    }
    if (typeof maybe.value === 'string' || typeof maybe.value === 'number') {
      return formatRichText(String(maybe.value))
    }
  }
  return formatRichText(String(value))
}

const toType = (value: unknown) => String(value || 'SHORT_ANSWER').toUpperCase()

export const getQuestionTypeLabel = (type: string) =>
  questionTypeLabels[toType(type)] ?? '题目'

const normalizeOptions = (input: unknown) => {
  if (!Array.isArray(input)) return [] as Array<{ id: string; text: string }>
  return input
    .map((item) => {
      const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return {
        id: String(source.id || '').trim(),
        text: String(source.text || '').trim(),
      }
    })
    .filter((item) => item.id)
}

const formatChoiceAnswer = (
  optionIds: string[],
  options: Array<{ id: string; text: string }>,
) => {
  if (!optionIds.length) return ''
  const map = new Map(options.map((item) => [item.id, item.text]))
  const labels = optionIds.map((id) => {
    const optionText = map.get(id)
    return optionText ? `${id}. ${optionText}` : id
  })
  return formatRichText(`正确答案：${labels.join('；')}`)
}

export const resolveBankPromptHtml = (question: unknown) => {
  if (!question || typeof question !== 'object') return ''
  const source = question as Record<string, unknown>
  const stem = source.stem && typeof source.stem === 'object'
    ? (source.stem as Record<string, unknown>).text
    : source.stem
  const prompt = source.prompt && typeof source.prompt === 'object'
    ? (source.prompt as Record<string, unknown>).text
    : source.prompt
  const description = source.description
  const title = source.title
  return (
    formatRichText(stem) ||
    formatRichText(prompt) ||
    formatRichText(description) ||
    formatRichText(title)
  )
}

export const resolveBankAnswerHtml = (question: unknown) => {
  if (!question || typeof question !== 'object') return ''
  const source = question as Record<string, unknown>
  const questionType = toType(source.questionType)
  const standardAnswer = source.standardAnswer
  const schema = source.questionSchema && typeof source.questionSchema === 'object'
    ? (source.questionSchema as Record<string, unknown>)
    : {}
  const options = normalizeOptions(schema.options)

  if (standardAnswer && typeof standardAnswer === 'object') {
    const answer = standardAnswer as Record<string, unknown>
    if (typeof answer.text === 'string') {
      return formatRichText(answer.text)
    }
    if (typeof answer.value === 'boolean') {
      return formatRichText(answer.value ? '正确' : '错误')
    }
    if (typeof answer.value === 'string') {
      return formatRichText(answer.value)
    }
    if (Array.isArray(answer.correctOptionIds)) {
      const ids = answer.correctOptionIds
        .map((item) => String(item || '').trim())
        .filter(Boolean)
      const formatted = formatChoiceAnswer(ids, options)
      if (formatted) return formatted
    }
    if (Array.isArray(answer.blanks)) {
      const blanks = answer.blanks.map((item) => String(item || '').trim()).filter(Boolean)
      if (blanks.length) {
        return formatRichText(`填空答案：${blanks.join('；')}`)
      }
    }
  }

  if (typeof standardAnswer === 'string') {
    return formatRichText(standardAnswer)
  }

  if (questionType === 'JUDGE') {
    return formatRichText('正确 / 错误')
  }
  return ''
}

export const resolveCustomPromptHtml = (question: unknown) => {
  if (!question || typeof question !== 'object') return ''
  const source = question as Record<string, unknown>
  return formatRichText(source.prompt) || formatRichText(source.title)
}

export const resolveCustomAnswerHtml = (question: unknown) => {
  if (!question || typeof question !== 'object') return ''
  const source = question as Record<string, unknown>
  const questionType = toType(source.questionType)
  const options = normalizeOptions(source.options)
  if (questionType === 'SINGLE_CHOICE' || questionType === 'MULTI_CHOICE') {
    const ids = Array.isArray(source.correctOptionIds)
      ? source.correctOptionIds.map((item) => String(item || '').trim()).filter(Boolean)
      : []
    return formatChoiceAnswer(ids, options)
  }
  if (questionType === 'JUDGE') {
    const judgeAnswer = source.judgeAnswer
    if (typeof judgeAnswer === 'boolean') {
      return formatRichText(judgeAnswer ? '正确' : '错误')
    }
    return ''
  }
  if (questionType === 'FILL_BLANK') {
    const blanks = Array.isArray(source.blankAnswers)
      ? source.blankAnswers.map((item) => String(item || '').trim()).filter(Boolean)
      : []
    return blanks.length ? formatRichText(`填空答案：${blanks.join('；')}`) : ''
  }
  return formatRichText(source.standardAnswerText)
}

export const normalizeQuestionOrder = (
  selectedQuestionIds: unknown,
  selectedQuestionOrder: unknown,
) => {
  const ids = Array.isArray(selectedQuestionIds)
    ? selectedQuestionIds.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const idSet = new Set(ids)
  const order = Array.isArray(selectedQuestionOrder)
    ? selectedQuestionOrder.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const normalized = order.filter((id) => idSet.has(id))
  ids.forEach((id) => {
    if (!normalized.includes(id)) {
      normalized.push(id)
    }
  })
  return normalized
}

export const createBankPreviewItem = (
  question: unknown,
  index: number,
  fallbackKey = '',
): PaperPreviewItem => {
  const source = question && typeof question === 'object'
    ? (question as Record<string, unknown>)
    : {}
  return {
    key: String(source.id || fallbackKey || `bank-${index}`),
    questionType: toType(source.questionType),
    title: String(source.title || '').trim(),
    promptHtml: resolveBankPromptHtml(source),
    answerHtml: resolveBankAnswerHtml(source),
    source: 'bank',
  }
}

export const createCustomPreviewItem = (
  question: unknown,
  index: number,
  fallbackKey = '',
): PaperPreviewItem => {
  const source = question && typeof question === 'object'
    ? (question as Record<string, unknown>)
    : {}
  return {
    key: String(source.tempId || fallbackKey || `custom-${index}`),
    questionType: toType(source.questionType),
    title: String(source.title || '').trim(),
    promptHtml: resolveCustomPromptHtml(source),
    answerHtml: resolveCustomAnswerHtml(source),
    source: 'custom',
  }
}
