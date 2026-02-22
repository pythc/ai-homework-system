const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration (override with env vars when needed)
const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = Number(process.env.API_PORT || 3000);

// Default paths are placeholders; set env vars to match your dataset.
const JSON_FILE_PATH = process.env.QB_JSON_PATH
  ? path.resolve(process.env.QB_JSON_PATH)
  : path.resolve(__dirname, '../../question_bank/question_bank.json');
const SOURCE_IMG_DIR = process.env.QB_IMG_SOURCE_DIR
  ? path.resolve(process.env.QB_IMG_SOURCE_DIR)
  : path.resolve(__dirname, '../../question_bank/images');
const TARGET_IMG_DIR_REL =
  process.env.QB_IMG_TARGET_REL || '../../client/public/question-bank-images';
const TARGET_IMG_DIR = path.resolve(__dirname, TARGET_IMG_DIR_REL);
const TARGET_IMG_URL_PREFIX =
  process.env.QB_IMG_URL_PREFIX || '/question-bank-images';

// User credentials (from seed)
const CREDENTIALS = {
  schoolId: process.env.QB_SCHOOL_ID || 'test-school',
  accountType: process.env.QB_ACCOUNT_TYPE || 'USERNAME',
  account: process.env.QB_ACCOUNT || 'admin',
  password: process.env.QB_PASSWORD || '123456',
};

async function request(method, pathStr, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/v1' + pathStr,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(
              new Error(
                `Request failed with status ${res.statusCode}: ${JSON.stringify(
                  parsed,
                )}`,
              ),
            );
          }
        } catch (e) {
          console.error('Raw response:', responseData);
          reject(e);
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

function processNode(node, stats) {
  if (!node) return;

  if (typeof node === 'object' && !Array.isArray(node)) {
    if (
      node.url &&
      typeof node.url === 'string' &&
      (node.url.startsWith('http') || node.url.startsWith('https'))
    ) {
      if (node.url.match(/\.(png|jpg|jpeg|gif)$/i)) {
        const fileName = path.basename(node.url);
        const sourcePath = path.join(SOURCE_IMG_DIR, fileName);
        const targetPath = path.join(TARGET_IMG_DIR, fileName);

        if (fs.existsSync(sourcePath)) {
          if (!fs.existsSync(targetPath)) {
            fs.copyFileSync(sourcePath, targetPath);
          }
          node.url = `${TARGET_IMG_URL_PREFIX}/${fileName}`;
          stats.success += 1;
        } else {
          console.warn(`Warning: Image not found: ${fileName}`);
          stats.missing += 1;
        }
      }
    }
  }

  if (typeof node === 'object') {
    for (const key in node) {
      processNode(node[key], stats);
    }
  }
}

async function main() {
  console.log('Starting question bank import...');

  // 1. Login
  console.log('Logging in...');
  let token;
  try {
    const loginRes = await request('POST', '/auth/login', CREDENTIALS);
    token = loginRes.data.token.accessToken;
    console.log('Login successful.');
  } catch (e) {
    console.error('Login failed. Ensure server is running.', e.message);
    process.exit(1);
  }

  // 2. Create or Find Course
  console.log('Checking for target course...');
  let courseId;
  const targetCourseName =
    process.env.QB_COURSE_NAME || 'Math Analysis';

  try {
    const coursesRes = await request('GET', '/courses', null, token);
    const courses = Array.isArray(coursesRes.data)
      ? coursesRes.data
      : coursesRes.data.items || [];

    const existingCourse = courses.find((c) => c.name === targetCourseName);
    if (existingCourse) {
      courseId = existingCourse.id;
      console.log(`Found existing course: ${targetCourseName} (${courseId})`);
    } else {
      console.log(`Creating course: ${targetCourseName}`);
      const createRes = await request(
        'POST',
        '/courses',
        {
          name: targetCourseName,
          semester: process.env.QB_SEMESTER || '2025-Spring',
          status: 'ACTIVE',
        },
        token,
      );
      courseId = createRes.data.id;
      console.log(`Course created: ${courseId}`);
    }
  } catch (e) {
    console.error('Course operation failed:', e.message);
    process.exit(1);
  }

  // 3. Process JSON & Images
  console.log('Processing JSON and Images...');

  if (!fs.existsSync(TARGET_IMG_DIR)) {
    console.log(`Creating directory: ${TARGET_IMG_DIR}`);
    fs.mkdirSync(TARGET_IMG_DIR, { recursive: true });
  }

  const rawData = fs.readFileSync(JSON_FILE_PATH, 'utf8');
  const jsonData = JSON.parse(rawData);

  jsonData.courseId = courseId;

  const stats = { success: 0, missing: 0 };
  processNode(jsonData, stats);
  console.log(`Image processing complete. Copied: ${stats.success}, Missing: ${stats.missing}`);

  // 4. Import
  console.log('Sending data to Import API...');
  try {
    const importRes = await request('POST', '/question-bank/import', jsonData, token);
    console.log('Import Success!', importRes);
  } catch (e) {
    console.error('Import API failed:', e.message);
    if (e.message.includes('ECONNRESET')) {
      console.error('Connection reset. Payload might be too large for the server configuration.');
    }
  }
}

main();
