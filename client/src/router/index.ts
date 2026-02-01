import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import Login from '../views/Login.vue'
import ResetPassword from '../views/ResetPassword.vue'
import StudentDashboard from '../views/StudentDashboard.vue'
import StudentAssignments from '../views/StudentAssignments.vue'
import StudentScores from '../views/StudentScores.vue'
import StudentAssistant from '../views/StudentAssistant.vue'
import StudentAssignmentSubmit from '../views/StudentAssignmentSubmit.vue'
// import TeacherDashboard from '../views/TeacherDashboard.vue'

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

  // {
  //   path: '/teacher',
  //   component: TeacherDashboard,
  // },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
