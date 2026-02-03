<template>
  <div class="teacher-dashboard">
    <h1>教师工作台</h1>
    <div class="nav-links">
       <router-link to="/teacher/question-bank" class="nav-item">题库管理</router-link>
       <!-- 
       <router-link to="/teacher/assignments" class="nav-item">作业管理</router-link> 
       -->
    </div>
    
    <div class="content">
      <!-- 负责人: 待定 (发布作业) -->
      <!-- 负责人: 待定 (批改作业) -->
      <p>欢迎回来，请选择左侧功能进行操作。</p>
    </div>
  </div>
</template>

<style scoped>
.teacher-dashboard {
  padding: 20px;
}
.nav-links {
  margin: 20px 0;
  display: flex;
  gap: 15px;
}
.nav-item {
  text-decoration: none;
  color: #fff;
  background-color: #007bff;
  padding: 10px 20px;
  border-radius: 5px;
}
.nav-item:hover {
  background-color: #0056b3;
}
</style>
