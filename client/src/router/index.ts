import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import Login from '../views/Login.vue'
import ResetPassword from '../views/ResetPassword.vue'
import StudentDashboard from '../views/StudentDashboard.vue'
import TeacherDashboard from '../views/TeacherDashboard.vue'
import QuestionBank from '../views/QuestionBank.vue'

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
    path: '/teacher',
    component: TeacherDashboard,
  },
  {
    path: '/teacher/question-bank',
    component: QuestionBank
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
