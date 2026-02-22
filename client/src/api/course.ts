import { httpRequest } from './http'

export type CourseItem = {
  id: string
  schoolId?: string
  name: string
  semester: string
  teacherId?: string
  teacherName?: string | null
  teacherAccount?: string | null
  status: string
  createdAt?: string
  updatedAt?: string
}

export type CourseSummary = {
  course: CourseItem
  studentCount: number
  assignmentCount: number
}

export type CourseStudent = {
  studentId: string
  name?: string | null
  account?: string | null
}

export type CourseGradebook = {
  course: CourseItem
  students: CourseStudent[]
  assignments: Array<{
    id: string
    title: string
    totalScore?: number
    deadline?: string | null
    order: number
    questions: Array<{ questionId: string; questionIndex: number; maxScore?: number; weight?: number | null }>
  }>
  cells: Array<{
    studentId: string
    assignmentId: string
    submissionVersionId: string | null
    finalScore: number | null
    aiScore: number | null
  }>
}

export type CourseListResponse = {
  items: CourseItem[]
}

export async function listCourses() {
  return httpRequest<CourseListResponse>('/courses', { method: 'GET' })
}

export async function getCourseSummary(courseId: string) {
  return httpRequest<CourseSummary>(`/courses/${courseId}/summary`, { method: 'GET' })
}

export async function getCourse(courseId: string) {
  return httpRequest<CourseItem>(`/courses/${courseId}`, { method: 'GET' })
}

export async function listCourseStudents(courseId: string) {
  return httpRequest<{ items: CourseStudent[] }>(`/courses/${courseId}/students`, {
    method: 'GET',
  })
}

export async function getCourseGradebook(courseId: string) {
  return httpRequest<CourseGradebook>(`/courses/${courseId}/gradebook`, { method: 'GET' })
}

export async function updateCourse(
  courseId: string,
  payload: { name?: string; semester?: string; teacherId?: string; status?: string },
) {
  return httpRequest<CourseItem>(`/courses/${courseId}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deleteCourse(courseId: string) {
  return httpRequest<{ success: boolean }>(`/courses/${courseId}`, {
    method: 'DELETE',
  })
}

export async function addCourseStudent(courseId: string, account: string, name: string) {
  return httpRequest<{
    success: boolean
    created: boolean
    defaultPassword: string | null
    student: { studentId: string; name?: string | null; account?: string | null }
  }>(`/courses/${courseId}/students`, {
    method: 'POST',
    body: { account, name },
  })
}

export async function removeCourseStudent(courseId: string, studentId: string) {
  return httpRequest<{ success: boolean }>(`/courses/${courseId}/students/${studentId}`, {
    method: 'DELETE',
  })
}
