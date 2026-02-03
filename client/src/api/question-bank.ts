import { httpRequest } from './http'
import { getAccessToken } from '../auth/storage'

// The backend prefix is /api/v1 (from main.ts)
// But httpRequest usually handles base url.
// logic in http.ts: 
// If API_BASE_URL defaults to http://localhost:3000/api/v1, then path should be 'question-bank'

// --- DEV: TOGGLE MOCK MODE --
const USE_MOCK = true; 
// ----------------------------

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

// Mock Data
let MOCK_DB: QuestionDto[] = [
  { 
    id: 'm1', title: '示例: 矩阵特征值计算', defaultScore: 10, nodeType: 'LEAF', questionType: 'CALCULATION', courseId: 'mock', chapterId: 'ch1',
    prompt: { 
      text: '请计算以下矩阵的特征值：\n\n$$ A = \\begin{pmatrix} 1 & 2 \\\\ 2 & 1 \\end{pmatrix} $$',
      media: [] 
    } 
  },
  { 
    id: 'm2', title: '示例: 线性空间定义', defaultScore: 5, nodeType: 'LEAF', questionType: 'PROOF', courseId: 'mock', chapterId: 'ch1',
    prompt: { 
      text: '### 问题描述\n简述线性空间的**八条公理**。', 
      media: [] 
    } 
  },
  {
    id: 'm3', title: '示例: 包含图片的题目', defaultScore: 5, nodeType: 'LEAF', questionType: 'Selection', courseId: 'mock', chapterId: 'ch1',
    prompt: {
      text: '请看图回答问题：此函数的单调递增区间是？',
      media: [{ type: 'image', url: 'https://via.placeholder.com/300x150?text=Graph', caption: '函数图像' }]
    }
  },
  {
    id: 'm4', title: '示例: 组合题 (GROUP)', defaultScore: 15, nodeType: 'GROUP', questionType: 'COMPLEX', courseId: 'mock', chapterId: 'ch2',
    stem: { text: '阅读以下材料，回答第1-2小题。\n> "人工智能正在改变教育..."', media: [] },
    children: [
      { id: 'm4-c1', title: '小题1', defaultScore: 5, nodeType: 'LEAF', questionType: 'CHOICE', courseId: 'mock', prompt: { text: '文中提到的核心观点是？' }, standardAnswer: 'A' },
      { id: 'm4-c2', title: '小题2', defaultScore: 10, nodeType: 'LEAF', questionType: 'ESSAY', courseId: 'mock', prompt: { text: '请谈谈你的看法。' } }
    ]
  }
];

function getAuthToken() {
  return getAccessToken()
}

export async function getQuestions(courseId: string) {
  if (USE_MOCK) return new Promise<QuestionDto[]>(r => setTimeout(() => r([...MOCK_DB]), 300));

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
  if (USE_MOCK) {
    if (data.questions) {
      data.questions.forEach((q: any) => MOCK_DB.push({ ...q, id: 'mock-' + Date.now() + Math.random() }));
    }
    return new Promise(r => setTimeout(() => r(true), 500));
  }

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
  if (USE_MOCK) {
    const idx = MOCK_DB.findIndex(q => q.id === id);
    if (idx !== -1) MOCK_DB[idx] = { ...MOCK_DB[idx], ...data };
    return new Promise(r => setTimeout(() => r(true), 300));
  }

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
  if (USE_MOCK) {
    MOCK_DB = MOCK_DB.filter(q => q.id !== id);
    return new Promise(r => setTimeout(() => r(true), 300));
  }

  const token = getAuthToken()
  const res = await httpRequest(ENDPOINT + '/' + id, {
    method: 'DELETE',
    token
  })
  if (!res.ok) throw new Error(res.error || 'Delete failed')
  return res.data
}

