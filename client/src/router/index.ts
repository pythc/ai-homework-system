import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import Login from '../views/Login.vue'
import ResetPassword from '../views/ResetPassword.vue'
import StudentDashboard from '../views/StudentDashboard.vue'
import StudentAssignments from '../views/StudentAssignments.vue'
import StudentScores from '../views/StudentScores.vue'
import StudentAssistant from '../views/StudentAssistant.vue'
import StudentAssignmentSubmit from '../views/StudentAssignmentSubmit.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminQuestionBank from '../views/AdminQuestionBank.vue'
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
    path: '/student/assignments/:assignmentId/submit',
    component: StudentAssignmentSubmit,
  },
  {
    path: '/student/scores',
    component: StudentScores,
  },
  {
    path: '/student/assistant',
    component: StudentAssistant,
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

export default router
