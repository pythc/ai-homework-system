// 验证异常情况（404）和 更新返回值
// 运行方式: node scripts/verify_edge_cases.js

const API_BASE = 'http://127.0.0.1:3000';

async function request(method, path, body = undefined) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    return { status: 'NETWORK_ERROR', data: err.message };
  }
}

async function main() {
  console.log('=== 验证异常处理与返回值 ===\n');

  // 1. 验证作业 404 (GET /assignments/non_existent)
  console.log('[1] 测试获取不存在的作业...');
  const res1 = await request('GET', '/assignments/asg_99999');
  if (res1.status === 404) {
    console.log('SUCCESS: 正确返回 404 Not Found');
  } else {
    console.error('FAILED: 预期 404, 实际', res1.status);
  }

  // 2. 验证作业更新返回值 (PATCH /assignments/:id)
  console.log('\n[2] 测试作业更新返回值...');
  // 先创建一个
  const createRes = await request('POST', '/assignments', { 
    title: 'Temp Job', courseId: 'C1', questions: [] 
  });
  const id = createRes.data.id;
  
  // 更新它
  const updateRes = await request('PATCH', `/assignments/${id}`, { title: 'Updated Job' });
  if (updateRes.status === 200 && updateRes.data.title === 'Updated Job' && updateRes.data.id === id) {
    console.log('SUCCESS: 更新成功并返回了更新后的对象');
  } else {
    console.error('FAILED: 更新返回值不符合预期', updateRes);
  }

  // 3. 验证批改 404 (PUT /submissions/non_existent/grading)
  console.log('\n[3] 测试批改不存在的提交...');
  const gradeRes = await request('PUT', '/submissions/non_existent_id/grading', {
      source: 'MANUAL', totalScore: 0, items: []
  });
  if (gradeRes.status === 404) {
    console.log('SUCCESS: 正确返回 404 Not Found');
  } else {
    console.error('FAILED: 预期 404, 实际', gradeRes.status);
  }

  console.log('\n=== 验证结束 ===');
}

main();
