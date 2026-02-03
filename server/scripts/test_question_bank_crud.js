const http = require('http');

// Helper to make HTTP requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/question-bank' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTest() {
  console.log('=== 开始题库 CRUD 测试 ===\n');

  // 1. 导入数据 (Import)
  console.log('[1/4] 测试导入数据...');
  const importData = {
    version: "test_v1",
    courseId: "test_course",
    textbook: { textbookId: "tb_test", title: "Test Book", publisher: "Test Pub", subject: "Test" },
    chapters: [{ chapterId: "ch_test", title: "Test Chapter", orderNo: 1 }],
    questions: [
      {
        questionId: "q_test_1",
        chapterId: "ch_test",
        nodeType: "LEAF",
        questionType: "PROOF",
        title: "测试题目1",
        defaultScore: 10
      },
      {
        questionId: "q_test_2",
        chapterId: "ch_test",
        nodeType: "LEAF",
        questionType: "PROOF",
        title: "将被删除的题目",
        defaultScore: 5
      }
    ]
  };
  
  const importRes = await request('POST', '/import', importData);
  console.log(`导入状态: ${importRes.statusCode} (预期 201)`);
  if (importRes.statusCode !== 201) {
    console.error('导入失败，终止测试');
    return;
  }

  // 2. 查询列表 (Read)
  console.log('\n[2/4] 测试获取列表...');
  const listRes = await request('GET', '');
  const questions = listRes.data;
  console.log(`当前题目总数: ${questions.length}`);
  const q1 = questions.find(q => q.id === 'q_test_1');
  const q2 = questions.find(q => q.id === 'q_test_2');

  if (!q1 || !q2) {
    console.error('未找到刚导入的题目，测试失败');
    return;
  }
  console.log('-> 成功找到导入的题目');

  // 3. 更新题目 (Update)
  console.log('\n[3/4] 测试更新题目 (q_test_1)...');
  const updateRes = await request('PATCH', `/q_test_1`, { 
    title: "测试题目1-已修改", 
    defaultScore: 20 
  });
  console.log(`更新状态: ${updateRes.statusCode}`);
  
  const verifyUpdateRes = await request('GET', '');
  const updatedQ1 = verifyUpdateRes.data.find(q => q.id === 'q_test_1');
  console.log(`-> 检查结果: 标题="${updatedQ1.title}", 分值=${updatedQ1.defaultScore}`);

  if (updatedQ1.title === "测试题目1-已修改" && updatedQ1.defaultScore === 20) {
    console.log('-> 更新测试通过');
  } else {
    console.error('-> 更新测试失败');
  }

  // 4. 删除题目 (Delete)
  console.log('\n[4/4] 测试删除题目 (q_test_2)...');
  const deleteRes = await request('DELETE', `/q_test_2`);
  console.log(`删除状态: ${deleteRes.statusCode}`);

  const verifyDeleteRes = await request('GET', '');
  const deletedQ2 = verifyDeleteRes.data.find(q => q.id === 'q_test_2');
  
  if (!deletedQ2) {
    console.log('-> 删除测试通过 (列表中已不存在该题目)');
  } else {
    console.error('-> 删除测试失败 (题目仍在列表中)');
  }

  console.log('\n=== 测试结束 ===');
}

runTest().catch(err => console.error('测试运行出错:', err));
