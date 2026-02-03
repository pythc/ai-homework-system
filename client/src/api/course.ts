import { httpRequest } from './http'

export type CourseItem = {
  id: string
  name: string
  semester: string
  status: string
}

export type CourseListResponse = {
  items: CourseItem[]
}

export async function listCourses() {
  return httpRequest<CourseListResponse>('/courses', { method: 'GET' })
}
