<template>
  <TeacherLayout
    title="题库目录"
    subtitle="全校共享题库（同校教师可共用）"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="题库目录"
  >
    <template #actions>
      <div class="topbar-profile">
        <div class="topbar-avatar">{{ profileName[0] }}</div>
        <div>
          <div class="topbar-name">{{ profileName }}</div>
          <div class="topbar-id">工号 {{ profileAccount }}</div>
        </div>
      </div>
    </template>

    <section class="panel glass">
      <div class="panel-title">题库入口</div>
      <div class="qb-list">
        <button class="qb-item" type="button" @click="goTextbooks">
          <div class="qb-item-title">全校共享题库</div>
          <div class="qb-item-meta">
            <span>同一学校内教师共享</span>
            <span>不跨学校</span>
          </div>
        </button>
        <button class="qb-item" type="button" @click="goPapers">
          <div class="qb-item-title">试卷</div>
          <div class="qb-item-meta">
            <span>复用布置作业题库筛选界面</span>
            <span>支持自定义题 + 本地保存</span>
          </div>
        </button>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const router = useRouter()

onMounted(async () => {
  await refreshProfile()
})

const goTextbooks = () => {
  router.push('/teacher/question-bank/courses/shared/textbooks')
}

const goPapers = () => {
  router.push('/teacher/question-bank/papers')
}
</script>
