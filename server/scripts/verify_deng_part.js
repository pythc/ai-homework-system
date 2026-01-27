// 这是一个简单的验证脚本，用于验证邓翀宸负责的 Assignment 和 Manual Grading 接口
// 运行前请确保后端服务已启动 (npm start)
// 运行方式: node scripts/verify_deng_part.js

const API_BASE = 'http://127.0.0.1:3000';

// 简单的 fetch 封装
async function request(method, path, body = undefined) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    console.error(`Request failed: ${method} ${path}`, err.message);
    return null;
  }
}

async function main() {
  console.log('=== 开始验证 Deng Chongchen 部分接口 ===\n');

  // 1. 创建作业 (POST /assignments)
  console.log('[1] 创建作业...');
  const createDto = {
    title: '期末线性代数测试',
    courseId: 'CS101',
    description: '请完成所有题目',
    questions: [
      {
        index: 1,
        description: '矩阵乘法',
        maxScore: 10,
        rubricItems: [
          { rubricKey: 'step1', description: '维度检查', maxScore: 2 },
          { rubricKey: 'step2', description: '计算过程', maxScore: 8 }
        ]
      }
    ],
    deadline: new Date(Date.now() + 86400000).toISOString()
  };

  const createRes = await request('POST', '/assignments', createDto);
  if (!createRes || createRes.status !== 201) {
    console.error('FAILED: 创建作业失败', createRes);
    return;
  }
  const assignmentId = createRes.data.id;
  console.log(`SUCCESS: 作业已创建, ID: ${assignmentId}\n`);

  // 2. 查看作业详情 (GET /assignments/:id)
  console.log('[2] 获取作业详情...');
  const getRes = await request('GET', `/assignments/${assignmentId}`);
  if (!getRes || getRes.status !== 200) {
    console.error('FAILED: 获取作业失败');
  } else {
    console.log(`SUCCESS: 获取用作业成功, Title: ${getRes.data.title}\n`);
  }

  // 3. 发布作业 (POST /assignments/:id/publish)
  console.log('[3] 发布作业...');
  const pubRes = await request('POST', `/assignments/${assignmentId}/publish`);
  if (!pubRes || pubRes.status !== 201) {
    console.error('FAILED: 发布作业失败', pubRes);
  } else {
    console.log(`SUCCESS: 作业已发布, SnapshotID: ${pubRes.data.snapshotId}\n`);
  }

  // 4. 模拟教师人工改分 (PUT /submissions/:id/grading)
  // 这里我们随便造一个 submissionId，因为 Mock Service 不会校验真实性
  console.log('[4] 提交人工改分...');
  const submissionId = 'sub_mock_123';
  const gradingDto = {
    source: 'MANUAL',
    totalScore: 9,
    finalComment: '总体不错，有一点小瑕疵',
    items: [
      { questionIndex: 1, rubricItemKey: 'step1', score: 2 },
      { questionIndex: 1, rubricItemKey: 'step2', score: 7, reason: '计算有小错误' }
    ]
  };

  const gradeRes = await request('PUT', `/submissions/${submissionId}/grading`, gradingDto);
  if (!gradeRes || gradeRes.status !== 200) {
    console.error('FAILED: 人工改分提交失败', gradeRes);
  } else {
    console.log(`SUCCESS: 人工改分提交成功, GradingID: ${gradeRes.data.gradingId}\n`);
  }

  console.log('=== 验证完成 ===');
}

main();
