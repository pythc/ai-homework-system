<template>
  <div class="question-bank-container">
    <div class="header">
      <h1>题库管理</h1>
      <button class="btn primary" @click="showImportModal = true">导入题库 (JSON)</button>
    </div>

    <!-- Question List -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>类型</th>
            <th>章节 ID</th>
            <th>分值</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in questions" :key="q.id">
            <td>{{ q.id }}</td>
            <td>{{ q.title }}</td>
            <td>{{ q.nodeType }} / {{ q.questionType }}</td>
            <td>{{ q.chapterId || '-' }}</td>
            <td>{{ q.defaultScore || '-' }}</td>
            <td>
              <button class="btn sm" @click="editQuestion(q)">编辑</button>
              <button class="btn sm danger" @click="removeQuestion(q.id)">删除</button>
            </td>
          </tr>
          <tr v-if="questions.length === 0">
            <td colspan="6" class="empty-state">暂无题目数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Import Modal -->
    <div v-if="showImportModal" class="modal-overlay">
      <div class="modal">
        <h2>导入题目 (JSON)</h2>
        <textarea 
          v-model="importJsonStr" 
          placeholder="在此粘贴题目 JSON 数据..."
          rows="15"
        ></textarea>
        <div class="modal-actions">
          <button class="btn" @click="showImportModal = false">取消</button>
          <button class="btn primary" @click="handleImport">确认导入</button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-overlay">
      <div class="modal">
        <h2>编辑题目 - {{ currentQuestion.title }}</h2>
        
        <div class="form-group">
          <label>标题</label>
          <input v-model="editForm.title" />
        </div>
        
        <div class="form-group">
          <label>分值</label>
          <input type="number" v-model="editForm.defaultScore" />
        </div>

        <div class="form-group">
          <label>题干 / 问题文本 (Stem/Prompt)</label>
          <textarea v-model="editForm.textContent" rows="5"></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn" @click="showEditModal = false">取消</button>
          <button class="btn primary" @click="handleUpdate">保存修改</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { getQuestions, importQuestions, updateQuestion, deleteQuestion } from '../api/question-bank';

const questions = ref([]);
const showImportModal = ref(false);
const showEditModal = ref(false);
const importJsonStr = ref('');

const currentQuestion = ref(null);
const editForm = reactive({
  title: '',
  defaultScore: 0,
  textContent: ''
});

// For demonstration, we assume a courseId. In real app, get from route or store.
// Using a fixed UUID that matches the seed script for testing.
const COURSE_ID = '22222222-2222-2222-2222-222222222222'; 

const loadData = async () => {
  try {
    const data = await getQuestions(COURSE_ID);
    // Backend service filters by courseId. 
    questions.value = data || [];
  } catch (err) {
    console.error('Failed to load questions', err);
    // Silent fail or toast
  }
};

onMounted(() => {
  loadData();
});

const handleImport = async () => {
  try {
    const json = JSON.parse(importJsonStr.value);
    await importQuestions(json);
    alert('Import successful!');
    showImportModal.value = false;
    importJsonStr.value = '';
    loadData();
  } catch (err) {
    console.error(err);
    alert('Import failed: ' + err.message);
  }
};

const editQuestion = (q) => {
  currentQuestion.value = q;
  editForm.title = q.title;
  editForm.defaultScore = q.defaultScore;
  
  // Try to extract text content based on type
  if (q.nodeType === 'GROUP' && q.stem) {
    editForm.textContent = q.stem.text;
  } else if (q.prompt) {
    editForm.textContent = q.prompt.text;
  } else {
    editForm.textContent = '';
  }

  showEditModal.value = true;
};

const handleUpdate = async () => {
  if (!currentQuestion.value) return;
  
  const updates = {
    title: editForm.title,
    defaultScore: Number(editForm.defaultScore)
  };

  // Update text content back to structure
  if (currentQuestion.value.nodeType === 'GROUP') {
    updates.stem = { ...currentQuestion.value.stem, text: editForm.textContent };
  } else {
    updates.prompt = { ...currentQuestion.value.prompt, text: editForm.textContent };
  }

  try {
    await updateQuestion(currentQuestion.value.id, updates);
    alert('Updated successfully');
    showEditModal.value = false;
    loadData();
  } catch (err) {
    alert('Update failed: ' + err.message);
  }
};

const removeQuestion = async (id) => {
  if (!confirm('Are you sure you want to delete this question?')) return;
  try {
    await deleteQuestion(id);
    loadData();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
};
</script>

<style scoped>
.question-bank-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.table-container {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background-color: #f8f9fa;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  color: #888;
  padding: 30px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
}

.btn.primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn.danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
  margin-left: 8px;
}

.btn.sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn:hover {
  opacity: 0.9;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 24px;
  border-radius: 8px;
  width: 600px;
  max-width: 90%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.modal h2 {
  margin-top: 0;
  margin-bottom: 16px;
}

.modal textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
}

.modal input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>
