import { httpRequest } from './http'

export type QuestionBankItem = {
  id: string
  courseId: string
  chapterId?: string | null
  nodeType: 'GROUP' | 'LEAF'
  questionType: string
  title?: string | null
  description?: string | null
  stem?: unknown | null
  prompt?: unknown | null
  standardAnswer?: unknown | null
  rubric?: unknown | null
  orderNo?: number | null
  createdAt?: string
  updatedAt?: string
}

export type QuestionBankListResponse = QuestionBankItem[]

export type QuestionBankUpdateRequest = {
  title?: string
  questionType?: string
  description?: string
  orderNo?: number
}

export async function listQuestionBank(courseId?: string) {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
  return httpRequest<QuestionBankListResponse>(`/question-bank${query}`, {
    method: 'GET',
  })
}

export type QuestionBankStructureResponse = {
  textbooks: Array<{
    id: string
    courseId: string
    visibleSchoolIds?: string[]
    externalId: string
    title: string
    subject: string
  }>
  chapters: Array<{
    id: string
    textbookId: string
    externalId: string
    parentId?: string | null
    title: string
    orderNo: number
  }>
}

export async function getQuestionBankStructure(courseId?: string) {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
  return httpRequest<QuestionBankStructureResponse>(
    `/question-bank/structure${query}`,
    {
      method: 'GET',
    },
  )
}

export async function getQuestionBankQuestion(id: string) {
  return httpRequest<QuestionBankItem>(`/question-bank/${id}`, {
    method: 'GET',
  })
}

export async function updateQuestionBankItem(
  id: string,
  payload: QuestionBankUpdateRequest,
) {
  return httpRequest<QuestionBankItem>(`/question-bank/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deleteQuestionBankItem(id: string) {
  return httpRequest<{ success: boolean }>(`/question-bank/${id}`, {
    method: 'DELETE',
  })
}

export async function importQuestionBank(payload: unknown) {
  return httpRequest<unknown>('/question-bank/import', {
    method: 'POST',
    body: payload,
  })
}

export async function listQuestionBankSchools() {
  return httpRequest<{ items: Array<{ schoolId: string }> }>('/question-bank/schools', {
    method: 'GET',
  })
}

export async function updateTextbookVisibility(textbookId: string, schoolIds: string[]) {
  return httpRequest<{ success: boolean; textbookId: string; schoolIds: string[] }>(
    `/question-bank/textbooks/${textbookId}/visibility`,
    {
      method: 'PATCH',
      body: { schoolIds },
    },
  )
}
