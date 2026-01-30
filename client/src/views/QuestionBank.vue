<template>
  <div class="question-bank-container">
    <div class="header">
      <h1>题库管理</h1>
      <div class="header-actions">
        <!-- Local Folder Loader -->
        <div class="local-loader">
          <input type="text" v-model="localPathDisplay" placeholder="选择本地题库文件夹..." readonly class="path-display" />
          <button class="btn outline" @click="triggerFolderSelect" title="浏览本地文件夹">📂 加载本地文件夹</button>
          <input 
            type="file" 
            ref="folderInput" 
            webkitdirectory 
            directory 
            multiple 
            style="display: none" 
            @change="handleFolderSelect" 
          />
        </div>
        <div class="divider-v"></div>
        <button class="btn primary" @click="showImportModal = true">导入题库 (JSON)</button>
      </div>
    </div>

    <!-- Question List -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 80px">ID</th>
            <th style="width: 200px">标题</th>
            <th>类型</th>
            <th>内容预览</th>
            <th style="width: 60px">分值</th>
            <th style="width: 150px">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="q in questions" :key="q.id">
            <!-- Main Row -->
            <tr :class="{ 'group-row': q.nodeType === 'GROUP' }">
              <td>{{ shortenId(q.id) }}</td>
              <td>
                <div class="title-text">{{ q.title }}</div>
                <span v-if="q.nodeType === 'GROUP'" class="badge">组合题 ({{ q.children?.length || 0 }}小题)</span>
              </td>
              <td>{{ q.nodeType }} / {{ q.questionType }}</td>
              <td class="preview-cell">
                <QuestionPreview :content="q.nodeType === 'GROUP' ? q.stem : q.prompt" />
              </td>
              <td>{{ q.defaultScore || '-' }}</td>
              <td>
                <button class="btn sm" @click="editQuestion(q)">编辑详情</button>
                <button class="btn sm danger" @click="removeQuestion(q.id)">删除</button>
              </td>
            </tr>
            <!-- Children Row (Visual Indication) -->
            <tr v-if="q.nodeType === 'GROUP' && q.children?.length" class="children-row-container">
              <td colspan="6" class="no-padding">
                <div class="children-list-preview">
                  <div v-for="(child, idx) in q.children" :key="child.id || idx" class="child-item-preview">
                     <span class="child-index">#{{ idx + 1 }}</span>
                     <span class="child-type">[{{ child.questionType }}]</span>
                     <QuestionPreview :content="child.prompt" :truncate="50" />
                     <span class="child-score">Score: {{ child.defaultScore }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
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
        <p class="hint">支持完整 JSON 结构，包含 text, media (url) 等字段。</p>
        <textarea 
          v-model="importJsonStr" 
          placeholder='Example: {"questions": [{ "title": "...", "content": { "text": "...", "media": [...] } }]}'
          rows="15"
          class="code-editor"
        ></textarea>
        <div class="modal-actions">
          <button class="btn" @click="showImportModal = false">取消</button>
          <button class="btn primary" @click="handleImport">确认导入</button>
        </div>
      </div>
    </div>

    <!-- Edit Modal (Enhanced) -->
    <div v-if="showEditModal && currentQuestion" class="modal-overlay">
      <div class="modal large-modal">
        <div class="modal-header">
          <h2>{{ editMode === 'JSON' ? '编辑 JSON' : '编辑题目详情' }} - {{ currentQuestion.title }}</h2>
          <div class="mode-switch">
             <button :class="{ active: editMode === 'UI' }" @click="editMode = 'UI'">可视化编辑</button>
             <button :class="{ active: editMode === 'JSON' }" @click="enterJsonMode">JSON 源码</button>
          </div>
        </div>
        
        <div class="modal-body">
          <!-- JSON Mode -->
          <div v-if="editMode === 'JSON'" class="json-editor-container">
            <textarea v-model="editJsonStr" class="code-editor full-height"></textarea>
          </div>

          <!-- UI Mode -->
          <div v-else class="ui-editor-container">
            <div class="form-row">
              <div class="form-group half">
                <label>标题</label>
                <input v-model="editForm.title" />
              </div>
              <div class="form-group half">
                 <label>分值</label>
                 <input type="number" v-model="editForm.defaultScore" />
              </div>
            </div>

            <!-- Content Editor: Stem (Group) or Prompt (Leaf) -->
            <div class="form-group">
               <label>{{ currentQuestion.nodeType === 'GROUP' ? '题干 (Stem) - 支持 Markdown' : '问题描述 (Prompt) - 支持 Markdown' }}</label>
               <div class="rich-editor">
                 <textarea v-model="editForm.mainText" rows="5" placeholder="在此输入 Markdown 内容..."></textarea>
                 <div class="media-list">
                    <label>图片列表 (URLs):</label>
                    <div v-for="(img, idx) in editForm.mainMedia" :key="idx" class="media-item-input">
                       <input v-model="img.url" placeholder="https://example.com/image.png" />
                       <input v-model="img.caption" placeholder="图片说明" style="width: 100px" />
                       <button class="btn sm danger" @click="editForm.mainMedia.splice(idx, 1)">x</button>
                    </div>
                    <button class="btn sm" @click="editForm.mainMedia.push({ type: 'image', url: '', caption: '' })">+ 添加图片</button>
                 </div>
               </div>
            </div>

            <!-- Group Children Editor -->
            <div v-if="currentQuestion.nodeType === 'GROUP'" class="children-section">
               <h3>包含小题 ({{ editForm.children.length }})</h3>
               <div class="children-editor-list">
                  <div v-for="(child, idx) in editForm.children" :key="idx" class="child-card">
                     <div class="child-header">
                        <span>小题 {{ idx + 1 }}</span>
                        <div class="actions">
                          <button class="btn sm danger" @click="editForm.children.splice(idx, 1)">移除</button>
                        </div>
                     </div>
                     <div class="form-row">
                        <input v-model="child.title" placeholder="小题标题" />
                        <input type="number" v-model="child.defaultScore" placeholder="分值" style="width: 80px" />
                        <select v-model="child.questionType">
                           <option value="CHOICE">选择题</option>
                           <option value="ESSAY">问答题</option>
                           <option value="CALCULATION">计算题</option>
                        </select>
                     </div>
                     <textarea v-model="child.promptText" rows="2" placeholder="小题描述..."></textarea>
                  </div>
                  <button class="btn block dashed" @click="addChildQuestion">+ 添加小题</button>
               </div>
            </div>

          </div>
        </div>

        <div class="modal-actions">
          <button class="btn" @click="showEditModal = false">关闭</button>
          <button class="btn primary" @click="handleUpdate">保存修改</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue';
import { getQuestions, importQuestions, updateQuestion, deleteQuestion } from '../api/question-bank';

// --- Markdown Component ---
const MarkdownRenderer = {
  props: ['text'],
  template: `<div class="md-content" v-html="parsed"></div>`,
  setup(props) {
    const parsed = computed(() => {
        if (!props.text) return '';
        let html = props.text
          // Bold
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          // Header
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          // List
          .replace(/^\- (.*$)/gm, '<li>$1</li>')
          // Newlines
          .replace(/\n/g, '<br>');
        
        // Mathjax proxy (super simple display)
        html = html.replace(/\$\$(.*?)\$\$/g, '<code class="math-block">$1</code>');
        return html;
    });
    return { parsed };
  }
};

const QuestionPreview = {
  components: { MarkdownRenderer },
  props: ['content', 'truncate'],
  template: `
    <div class="q-preview">
      <div v-if="text" class="text-preview">
        <MarkdownRenderer :text="displayText" />
      </div>
      <div v-if="images.length" class="media-preview">
        <img v-for="(img, i) in images" :key="i" :src="img.url" :alt="img.caption" />
      </div>
      <div v-if="!text && !images.length" class="no-content">无内容</div>
    </div>
  `,
  setup(props) {
    const text = computed(() => {
       if (!props.content) return '';
       const raw = typeof props.content === 'string' ? props.content : props.content.text || '';
       return raw;
    });
    const images = computed(() => {
       if (!props.content || typeof props.content === 'string') return [];
       return (props.content.media || []).filter(m => m.type === 'image');
    });
    const displayText = computed(() => {
       const t = text.value;
       if (props.truncate && t.length > props.truncate) {
         return t.substring(0, props.truncate) + '...';
       }
       return t;
    });
    return { text, images, displayText };
  }
};
// ----------------------------

const questions = ref([]);
const showImportModal = ref(false);
const showEditModal = ref(false);
const importJsonStr = ref('');
const editMode = ref('UI'); // 'UI' | 'JSON'
const editJsonStr = ref('');

const currentQuestion = ref(null);
const editForm = reactive({
  title: '',
  defaultScore: 0,
  mainText: '',
  mainMedia: [], // Array<{type, url, caption}>
  children: []   // Array<{...}>
});

// --- Local Folder Loading Logic ---
const localPathDisplay = ref('');
const folderInput = ref(null);

const triggerFolderSelect = () => {
  if (folderInput.value) {
    folderInput.value.click();
  }
};

const handleFolderSelect = async (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  // 1. Display Selected Root Folder Name
  const rootPath = files[0].webkitRelativePath || '';
  localPathDisplay.value = rootPath.split('/')[0] || 'Selected Folder';

  // 2. Prepare Maps
  const imageMap = new Map();
  const jsonFiles = [];

  // Scan all files
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relPath = file.webkitRelativePath; // e.g. "Bank/Book1/images/1.png"
    
    if (file.name.toLowerCase().endsWith('.json')) {
      jsonFiles.push(file);
    } else if (file.type.startsWith('image/')) {
       // Create Blob URL for preview
       imageMap.set(relPath, URL.createObjectURL(file));
    }
  }

  if (jsonFiles.length === 0) {
    alert('未在所选文件夹中找到 JSON 文件 (.json)');
    return;
  }

  // 3. Process JSONs
  let allQuestions = [];
  let errorCount = 0;

  for (const file of jsonFiles) {
    try {
      const text = await readFileAsText(file);
      const data = JSON.parse(text);
      
      // Assume data structure { questions: [...] } or just [...] or other structure
      // Adjust according to your JSON format. Assuming standard { questions: [] }
      let rawList = [];
      if (Array.isArray(data)) rawList = data;
      else if (data && Array.isArray(data.questions)) rawList = data.questions;
      else {
         // Maybe single object?
         console.warn(`Skipping ${file.name}: invalid format`);
         continue;
      }

      // Determine "Current Directory" of this json file relative to the root selection
      // relPath: "Bank/Category/data.json" -> curDir: "Bank/Category"
      const fullRelPath = file.webkitRelativePath;
      const curDir = fullRelPath.substring(0, fullRelPath.lastIndexOf('/'));

      const list = rawList.map(q => processLocalQuestion(q, curDir, imageMap));
      allQuestions.push(...list);

    } catch (err) {
      console.error(`Error processing ${file.name}`, err);
      errorCount++;
    }
  }

  questions.value = allQuestions;
  alert(`加载完成！共读取 ${allQuestions.length} 道题目。${errorCount > 0 ? `(${errorCount} 个文件出错)` : ''}`);
};

const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const processLocalQuestion = (q, curDir, imageMap) => {
  // Helper to fix media url
  const fixUrl = (mediaList) => {
    if (!mediaList) return;
    mediaList.forEach(m => {
       if (m.type === 'image' && m.url && !m.url.startsWith('http') && !m.url.startsWith('data:')) {
          // Construct potential key
          // 1. naive join: curDir + '/' + m.url
          // Win/Mac path separator handling? webkitRelativePath uses '/'
          // q.url might use '\' or '/'
          const normalizedUrl = m.url.replace(/\\/g, '/');
          const targetKey = `${curDir}/${normalizedUrl}`;
          
          if (imageMap.has(targetKey)) {
             m.url = imageMap.get(targetKey);
          } else {
             // Try searching just by filename if path mismatch?
             // For now keep as is, or console log missing
             console.log(`Image not found in map: ${targetKey}`);
          }
       }
    });
  };

  // Clone to avoid mutation of raw data if referenced elsewhere (unlikely here)
  const copy = { ...q };
  
  if (copy.prompt && copy.prompt.media) fixUrl(copy.prompt.media);
  if (copy.stem && copy.stem.media) fixUrl(copy.stem.media); // For Group stems

  if (copy.children && copy.children.length > 0) {
      copy.children = copy.children.map(child => processLocalQuestion(child, curDir, imageMap));
  }
  
  // Ensure IDs are unique-ish for the view key
  if (!copy.id) copy.id = 'loc_' + Math.random().toString(36).substr(2, 9);
  
  return copy;
};
// ------------------------------------

const COURSE_ID = '22222222-2222-2222-2222-222222222222';

const shortenId = (id) => {
  return id && id.length > 8 ? id.substring(0, 8) + '...' : id;
}

const loadData = async () => {
  try {
    const data = await getQuestions(COURSE_ID);
    questions.value = data || [];
  } catch (err) {
    console.error('Failed to load questions', err);
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

const enterJsonMode = () => {
  // Sync UI to JSON
  // To do this strictly, we need to construct the full object from editForm
  // But for now let's just use the currentQuestion source merged with editForm basics
  if (!currentQuestion.value) return;
  
  // Reconstruct basic structure
  const base = JSON.parse(JSON.stringify(currentQuestion.value));
  base.title = editForm.title;
  base.defaultScore = Number(editForm.defaultScore);

  const newContent = { 
     text: editForm.mainText, 
     media: editForm.mainMedia.map(m => ({ ...m })) 
  };

  if (base.nodeType === 'GROUP') {
     base.stem = newContent;
     // Map children back
     // Note: This is a simplification. Usually children editing is complex. 
     // We will accept that JSON mode is the source of truth if switched.
  } else {
     base.prompt = newContent;
  }
  
  editJsonStr.value = JSON.stringify(base, null, 2);
  editMode.value = 'JSON';
};

const editQuestion = (q) => {
  currentQuestion.value = q;
  editForm.title = q.title;
  editForm.defaultScore = q.defaultScore;
  editForm.children = [];

  // Parse Children
  if (q.children) {
    editForm.children = q.children.map(c => ({
      ...c,
      promptText: typeof c.prompt === 'string' ? c.prompt : (c.prompt?.text || '')
    }));
  }

  // Parse Main Content
  const content = q.nodeType === 'GROUP' ? q.stem : q.prompt;
  if (content && typeof content === 'object') {
     editForm.mainText = content.text || '';
     editForm.mainMedia = (content.media || []).map(m => ({...m}));
  } else if (typeof content === 'string') {
     editForm.mainText = content;
     editForm.mainMedia = [];
  } else {
     editForm.mainText = '';
     editForm.mainMedia = [];
  }

  editMode.value = 'UI';
  showEditModal.value = true;
};

const addChildQuestion = () => {
  editForm.children.push({
    title: '新小题',
    defaultScore: 2,
    questionType: 'CHOICE',
    promptText: '',
    nodeType: 'LEAF'
  });
};

const handleUpdate = async () => {
  let updates = {};

  if (editMode.value === 'JSON') {
    try {
      updates = JSON.parse(editJsonStr.value);
    } catch (e) {
      alert('JSON 格式错误');
      return;
    }
  } else {
    // UI Mode -> Object
    updates = {
      title: editForm.title,
      defaultScore: Number(editForm.defaultScore)
    };

    const newContentObj = {
      text: editForm.mainText,
      media: editForm.mainMedia.filter(m => m.url)
    };

    if (currentQuestion.value.nodeType === 'GROUP') {
       updates.stem = newContentObj;
       // Reconstruct children
       updates.children = editForm.children.map(c => ({
          ...c,
          prompt: { text: c.promptText, media: [] } // Simplify children media for now
       }));
    } else {
       updates.prompt = newContentObj;
    }
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
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.local-loader {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0f7ff;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #cce4ff;
}

.path-display {
  width: 200px;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
  background: white;
}

.divider-v {
  width: 1px;
  height: 24px;
  background: #eee;
  margin: 0 5px;
}

.table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.preview-cell {
  max-width: 400px;
  color: #666;
  font-size: 0.9em;
}

.children-row-container {
  background-color: #fcfcfc;
}
.children-list-preview {
  padding: 10px 20px 10px 60px; /* indent */
  border-left: 4px solid #e9ecef;
}
.child-item-preview {
  display: flex;
  gap: 10px;
  align-items: center;
  border-bottom: 1px dashed #eee;
  padding: 5px 0;
  font-size: 0.85em;
  color: #555;
}
.child-index { font-weight: bold; color: #888; }
.child-score { margin-left: auto; color: #999; }

/* Modal Styles */
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
  display: flex;
  flex-direction: column;
}

.large-modal {
  max-width: 900px;
  height: 80vh;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 10px;
}

.mode-switch button {
  padding: 5px 10px;
  border: 1px solid #ccc;
  background: #f1f1f1;
  cursor: pointer;
}
.mode-switch button:first-child { border-radius: 4px 0 0 4px; }
.mode-switch button:last-child { border-radius: 0 4px 4px 0; }
.mode-switch button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

/* UI Editor */
.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
.form-group.half { flex: 1; }

input, select, textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.code-editor {
  font-family: monospace;
  background: #f8f8f8;
  font-size: 13px;
}
.full-height { height: 100%; min-height: 400px; }

/* Rich Editor Simulation */
.rich-editor {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
}
.rich-editor textarea { border: none; outline: none; resize: vertical; margin-bottom: 10px; }

.media-list {
  background: #fafafa;
  padding: 10px;
  border-top: 1px solid #eee;
}
.media-item-input {
  display: flex;
  gap: 5px;
  margin-bottom: 5px;
}

/* Children Editor */
.children-section {
  margin-top: 20px;
  border-top: 2px solid #eee;
  padding-top: 15px;
}
.child-card {
  background: #fdfdfd;
  border: 1px solid #e0e0e0;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
}
.child-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.9em;
  font-weight: bold;
  color: #666;
}

/* Buttons */
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
}

.btn.sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn:hover {
  opacity: 0.9;
}

.btn.dashed { border: 1px dashed #ccc; background: white; color: #666; width: 100%; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

/* Common Classes */
.badge {
  display: inline-block;
  background: #e6f7ff;
  color: #1890ff;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 4px;
}
.empty-state {
  text-align: center;
  color: #888;
  padding: 30px;
}

/* Preview Styles (Deep selector or component internal) */
:deep(.q-preview) img {
  max-height: 100px;
  border: 1px solid #ddd;
  margin: 5px 5px 5px 0;
  border-radius: 4px;
}
:deep(.math-block) {
  background: #fff8e1;
  padding: 2px 4px;
  border-radius: 2px;
}
:deep(.md-content) h3 { font-size: 1.1em; margin: 5px 0; }
:deep(.md-content) li { margin-left: 20px; }
:deep(.md-content) text { color: #000; }
</style>
