import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getAccessToken, setCurrentAuthScope } from '../auth/storage'

import Login from '../views/Login.vue'
import ResetPassword from '../views/ResetPassword.vue'
import StudentDashboard from '../views/StudentDashboard.vue'
import StudentAssignments from '../views/StudentAssignments.vue'
import StudentAssignmentsCourse from '../views/StudentAssignmentsCourse.vue'
import StudentScores from '../views/StudentScores.vue'
import StudentScoresCourse from '../views/StudentScoresCourse.vue'
import StudentScoreDetail from '../views/StudentScoreDetail.vue'
import StudentAssistant from '../views/StudentAssistant.vue'
import StudentAssignmentSubmit from '../views/StudentAssignmentSubmit.vue'
import TeacherDashboard from '../views/TeacherDashboard.vue'
import TeacherCourses from '../views/TeacherCourses.vue'
import TeacherCourseOverview from '../views/TeacherCourseOverview.vue'
import TeacherCourseGradebook from '../views/TeacherCourseGradebook.vue'
import TeacherAssignmentPublish from '../views/TeacherAssignmentPublish.vue'
import TeacherGrading from '../views/TeacherGrading.vue'
import TeacherGradingOverview from '../views/TeacherGradingOverview.vue'
import TeacherGradingAssignments from '../views/TeacherGradingAssignments.vue'
import TeacherGradingSubmissions from '../views/TeacherGradingSubmissions.vue'
import TeacherAssistant from '../views/TeacherAssistant.vue'
import TeacherQuestionBankCourses from '../views/TeacherQuestionBankCourses.vue'
import TeacherQuestionBankTextbooks from '../views/TeacherQuestionBankTextbooks.vue'
import TeacherQuestionBankChapters from '../views/TeacherQuestionBankChapters.vue'
import TeacherQuestionBankChapterChildren from '../views/TeacherQuestionBankChapterChildren.vue'
import TeacherQuestionBankQuestions from '../views/TeacherQuestionBankQuestions.vue'
import TeacherQuestionBankQuestionDetail from '../views/TeacherQuestionBankQuestionDetail.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminQuestionBank from '../views/AdminQuestionBank.vue'
import AdminClassImport from '../views/AdminClassImport.vue'
import AdminCourses from '../views/AdminCourses.vue'
import AdminCourseDetail from '../views/AdminCourseDetail.vue'
import AdminQuestionBankCourses from '../views/AdminQuestionBankCourses.vue'
import AdminQuestionBankTextbooks from '../views/AdminQuestionBankTextbooks.vue'
import AdminQuestionBankChapters from '../views/AdminQuestionBankChapters.vue'
import AdminQuestionBankChapterChildren from '../views/AdminQuestionBankChapterChildren.vue'
import AdminQuestionBankQuestions from '../views/AdminQuestionBankQuestions.vue'
import AdminQuestionBankQuestionDetail from '../views/AdminQuestionBankQuestionDetail.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },

  {
    path: '/login',
    component: Login,
  },
  {
    path: '/reset-password',
    component: ResetPassword,
  },

  {
    path: '/student',
    component: StudentDashboard,
  },
  {
    path: '/student/assignments',
    component: StudentAssignments,
  },
  {
    path: '/student/assignments/course/:courseId',
    component: StudentAssignmentsCourse,
  },
  {
    path: '/student/assignments/:assignmentId/submit',
    component: StudentAssignmentSubmit,
  },
  {
    path: '/student/scores',
    component: StudentScores,
  },
  {
    path: '/student/scores/course/:courseId',
    component: StudentScoresCourse,
  },
  {
    path: '/student/scores/:assignmentId',
    component: StudentScoreDetail,
  },
  {
    path: '/student/assistant',
    component: StudentAssistant,
  },

  {
    path: '/teacher',
    component: TeacherDashboard,
  },
  {
    path: '/teacher/courses',
    component: TeacherCourses,
  },
  {
    path: '/teacher/courses/:courseId',
    component: TeacherCourseOverview,
  },
  {
    path: '/teacher/courses/:courseId/gradebook',
    component: TeacherCourseGradebook,
  },
  {
    path: '/teacher/assignments/publish',
    component: TeacherAssignmentPublish,
  },
  {
    path: '/teacher/grading',
    component: TeacherGradingOverview,
  },
  {
    path: '/teacher/grading/course/:courseId',
    component: TeacherGradingAssignments,
  },
  {
    path: '/teacher/grading/:assignmentId',
    component: TeacherGradingSubmissions,
  },
  {
    path: '/teacher/grading/:assignmentId/submission/:submissionVersionId',
    component: TeacherGrading,
  },
  {
    path: '/teacher/assistant',
    component: TeacherAssistant,
  },
  {
    path: '/teacher/question-bank',
    component: TeacherQuestionBankCourses,
  },
  {
    path: '/teacher/question-bank/courses/:courseId/textbooks',
    component: TeacherQuestionBankTextbooks,
  },
  {
    path: '/teacher/question-bank/courses/:courseId/textbooks/:textbookId/chapters',
    component: TeacherQuestionBankChapters,
  },
  {
    path: '/teacher/question-bank/courses/:courseId/textbooks/:textbookId/chapters/:chapterId',
    component: TeacherQuestionBankChapterChildren,
  },
  {
    path: '/teacher/question-bank/courses/:courseId/textbooks/:textbookId/chapters/:chapterId/questions',
    component: TeacherQuestionBankQuestions,
  },
  {
    path: '/teacher/question-bank/questions/:questionId',
    component: TeacherQuestionBankQuestionDetail,
  },

  {
    path: '/admin',
    component: AdminDashboard,
  },
  {
    path: '/admin/question-bank',
    component: AdminQuestionBank,
  },
  {
    path: '/admin/class-import',
    component: AdminClassImport,
  },
  {
    path: '/admin/courses',
    component: AdminCourses,
  },
  {
    path: '/admin/courses/:courseId',
    component: AdminCourseDetail,
  },
  {
    path: '/admin/question-bank/courses',
    component: AdminQuestionBankCourses,
  },
  {
    path: '/admin/question-bank/courses/:courseId/textbooks',
    component: AdminQuestionBankTextbooks,
  },
  {
    path: '/admin/question-bank/courses/:courseId/textbooks/:textbookId/chapters',
    component: AdminQuestionBankChapters,
  },
  {
    path: '/admin/question-bank/courses/:courseId/textbooks/:textbookId/chapters/:chapterId',
    component: AdminQuestionBankChapterChildren,
  },
  {
    path: '/admin/question-bank/courses/:courseId/textbooks/:textbookId/chapters/:chapterId/questions',
    component: AdminQuestionBankQuestions,
  },
  {
    path: '/admin/question-bank/questions/:questionId',
    component: AdminQuestionBankQuestionDetail,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const path = to.path || ''
  if (path.startsWith('/teacher')) {
    setCurrentAuthScope('teacher')
  } else if (path.startsWith('/admin')) {
    setCurrentAuthScope('admin')
  } else if (path.startsWith('/student')) {
    setCurrentAuthScope('student')
  }
  if (path === '/login' || path === '/reset-password') return true
  if (path.startsWith('/student') || path.startsWith('/teacher') || path.startsWith('/admin')) {
    const token = getAccessToken()
    if (!token) {
      return '/login'
    }
  }
  return true
})

export default router
