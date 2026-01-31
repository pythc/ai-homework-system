const http = require('http');

const data = JSON.stringify({
  "version": "v1.1",
  "courseId": "c_001",
  "textbook": {
    "textbookId": "tb_math_analysis_1",
    "title": "数学分析 第五版 上册",
    "publisher": "华东师范大学出版社 第五版",
    "subject": "数学分析"
  },
  "chapters": [
    {
      "chapterId": "ch_1",
      "parentId": null,
      "title": "第一章 实数集与函数",
      "orderNo": 1
    },
    {
      "chapterId": "ch_1_1",
      "parentId": "ch_1",
      "title": "习题1.1",
      "orderNo": 1
    }
  ],
  "questions": [
    {
      "questionId": "q_001",
      "chapterId": "ch_1_1",
      "nodeType": "GROUP",
      "questionType": "PROOF",
      "title": "1.",
      "stem": {
        "text": "设 a 为有理数，x 为无理数。证明：",
        "media": [
          {
            "type": "image",
            "url": "https://<文件名>.png",
            "caption": "题干图",
            "orderNo": 1
          }
        ]
      },
      "children": [
        {
          "questionId": "q_001_1",
          "orderNo": 1,
          "nodeType": "LEAF",
          "questionType": "PROOF",
          "title": "(1)",
          "prompt": {
            "text": "a + x 是无理数。",
            "media": []
          },
          "standardAnswer": {
            "text": "用反证法。假设 a + x 为有理数，则 (a + x) - a = x 也为有理数，与 x 为无理数矛盾，故 a + x 为无理数。",
            "media": [
              {
                "type": "image",
                "url": "https://<文件名>.png",
                "caption": "解答示意",
                "orderNo": 1
              }
            ]
          },
          "defaultScore": 10,
          "rubric": [
            { "rubricItemKey": "R1", "maxScore": 4, "criteria": "正确使用反证法（先作相反假设）" },
            { "rubricItemKey": "R2", "maxScore": 4, "criteria": "推出 (a+x)-a=x 为有理数，并指出与 x 无理矛盾" },
            { "rubricItemKey": "R3", "maxScore": 2, "criteria": "结论表述清晰完整" }
          ]
        },
        {
          "questionId": "q_001_2",
          "orderNo": 2,
          "nodeType": "LEAF",
          "questionType": "PROOF",
          "title": "(2)",
          "prompt": {
            "text": "当 a ≠ 0 时，ax 是无理数。",
            "media": []
          },
          "standardAnswer": {
            "text": "用反证法。假设 ax 为有理数。因 a 为非零有理数，则 (ax)/a = x 为有理数，与 x 为无理数矛盾，故 ax 为无理数。",
            "media": []
          },
          "defaultScore": 10,
          "rubric": [
            { "rubricItemKey": "R1", "maxScore": 4, "criteria": "正确使用反证法（先作相反假设）" },
            { "rubricItemKey": "R2", "maxScore": 4, "criteria": "利用 a≠0 且为有理数，推出 (ax)/a=x 为有理数，并指出矛盾" },
            { "rubricItemKey": "R3", "maxScore": 2, "criteria": "结论表述清晰完整" }
          ]
        }
      ]
    },
    {
      "questionId": "q_003",
      "chapterId": "ch_1_1",
      "nodeType": "LEAF",
      "questionType": "PROOF",
      "title": "3.",
      "prompt": {
        "text": "设 a,b ∈ ℝ。证明：若对任何正数 ε，都有 |a - b| < ε，则 a = b。",
        "media": []
      },
      "standardAnswer": {
        "text": "用反证法。若 a ≠ b，则 η = |a-b| > 0。取 ε = η/2，则应有 |a-b| < ε，但 |a-b| = η ≥ η/2 = ε，矛盾。故 a = b。",
        "media": []
      },
      "defaultScore": 10,
      "rubric": [
        { "rubricItemKey": "R1", "maxScore": 4, "criteria": "能正确设 a≠b 并令 η=|a-b|>0" },
        { "rubricItemKey": "R2", "maxScore": 4, "criteria": "取 ε=η/2 并推出与条件 |a-b|<ε 矛盾" },
        { "rubricItemKey": "R3", "maxScore": 2, "criteria": "结论与逻辑收束清晰（因此 a=b）" }
      ]
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/question-bank/import',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('Sending request to http://localhost:3000/question-bank/import ...');

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('Response Body:', responseData);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  if (e.code === 'ECONNREFUSED') {
    console.log('\nError: Code ECONNREFUSED. \nIs the server running? Please run "npm run start:dev" in the server directory.');
  }
});

req.write(data);
req.end();
