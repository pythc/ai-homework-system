import { request } from '../utils/http'

export async function listCourses() {
  const data = await request('/courses', { method: 'GET' })
  return data?.items || []
}

export async function listTeacherCourses() {
  const data = await request('/courses', { method: 'GET' })
  return data?.items || []
}
