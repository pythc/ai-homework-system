<template>
  <StudentLayout
    title="提交作业"
    subtitle="请按要求提交作业内容"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="作业提交"
  >
    <section class="panel glass">
      <div class="panel-title">作业提交入口</div>
      <div class="task-empty">
        这里是作业提交页面占位内容，后续可接入上传文件/在线编辑。
      </div>
    </section>
  </StudentLayout>
</template>

<script setup>
import { onMounted } from 'vue'
import StudentLayout from '../components/StudentLayout.vue'
import { useStudentProfile } from '../composables/useStudentProfile'

const { profileName, profileAccount, refreshProfile } = useStudentProfile()

onMounted(async () => {
  await refreshProfile()
})
</script>
