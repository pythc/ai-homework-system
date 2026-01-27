import { httpRequest } from './http'
import { getAccessToken } from '../auth/storage'

// The backend prefix is /api/v1 (from main.ts)
// But httpRequest usually handles base url.
// logic in http.ts: 
// If API_BASE_URL defaults to http://localhost:3000/api/v1, then path should be 'question-bank'

export type QuestionDto = {
  id: string
  courseId: string
  // ... other fields matching backend entity
  title: string
  defaultScore: number
  nodeType: string
  questionType: string
  chapterId?: string
  prompt?: any
  stem?: any
  standardAnswer?: any
  children?: QuestionDto[]
}

const ENDPOINT = 'question-bank'

function getAuthToken() {
  return getAccessToken()
}

export async function getQuestions(courseId: string) {
  const token = getAuthToken()
  // Append query params manually.
  const query = courseId ? '?courseId=' + courseId : ''
  const res = await httpRequest<QuestionDto[]>(ENDPOINT + query, {
    method: 'GET',
    token
  })
  if (!res.ok) throw new Error(res.error || 'Failed to fetch questions')
  return res.data
}

export async function importQuestions(data: any) {
  const token = getAuthToken()
  const res = await httpRequest(ENDPOINT + '/import', {
    method: 'POST',
    body: JSON.stringify(data),
    token
  })
  if (!res.ok) throw new Error(res.error || 'Import failed')
  return res.data
}

export async function updateQuestion(id: string, data: Partial<QuestionDto>) {
  const token = getAuthToken()
  const res = await httpRequest(ENDPOINT + '/' + id, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token
  })
  if (!res.ok) throw new Error(res.error || 'Update failed')
  return res.data
}

export async function deleteQuestion(id: string) {
  const token = getAuthToken()
  const res = await httpRequest(ENDPOINT + '/' + id, {
    method: 'DELETE',
    token
  })
  if (!res.ok) throw new Error(res.error || 'Delete failed')
  return res.data
}

