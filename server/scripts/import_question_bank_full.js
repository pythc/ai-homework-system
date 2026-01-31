
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const API_HOST = 'localhost';
const API_PORT = 3000;
const JSON_FILE_PATH = path.resolve(__dirname, '../../question_bank/上册/数学分析_全书完整版(1-11章).json');
const SOURCE_IMG_DIR = path.resolve(__dirname, '../../question_bank/上册/图片');
const TARGET_IMG_DIR_REL = '../../client/public/question-bank-images/上册';
const TARGET_IMG_DIR = path.resolve(__dirname, TARGET_IMG_DIR_REL);
const TARGET_IMG_URL_PREFIX = '/question-bank-images/上册';

// User credentials (from seed)
const CREDENTIALS = {
  schoolId: 'test-school',
  accountType: 'USERNAME',
  account: 'admin',
  password: '123456'
};

async function request(method, pathStr, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/v1' + pathStr, // Added global prefix /api/v1
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.setEncoding('utf8');
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
            const parsed = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(parsed);
            } else {
                reject(new Error(`Request failed with status ${res.statusCode}: ${JSON.stringify(parsed)}`));
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
    
    // Check for image URL pattern
    if (typeof node === 'object' && !Array.isArray(node)) {
        // Look for values that might be image URLs
        // The structure from manual_test_import.js shows:
        // "media": [{ "type": "image", "url": "..." }]
        // But also check direct properties if any.
        // Actually earlier grep showed direct "url": "..." usage, likely inside media items or similar.
        
        if (node.url && typeof node.url === 'string' && (node.url.startsWith('http') || node.url.startsWith('https'))) {
             if (node.url.match(/\.(png|jpg|jpeg|gif)$/i)) {
                 const fileName = path.basename(node.url);
                 const sourcePath = path.join(SOURCE_IMG_DIR, fileName);
                 const targetPath = path.join(TARGET_IMG_DIR, fileName);

                 if (fs.existsSync(sourcePath)) {
                     // Check if target exists, optionally skip copy
                     if (!fs.existsSync(targetPath)) {
                        fs.copyFileSync(sourcePath, targetPath);
                     }
                     node.url = `${TARGET_IMG_URL_PREFIX}/${fileName}`;
                     stats.success++;
                 } else {
                     console.warn(`Warning: Image not found: ${fileName}`);
                     stats.missing++;
                 }
             }
        }
    }

    // Recursion
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
        console.error('Login failed. Ensure server is running (npm run start:dev).', e.message);
        process.exit(1);
    }

    // 2. Create or Find Course
    console.log('Checking for target course...');
    let courseId;
    const targetCourseName = '数学分析';
    
    try {
        const coursesRes = await request('GET', '/courses', null, token);
        // Assuming courses.items or similar for pagination, or array.
        // Let's inspect data structure if it fails, but usually it's { data: items, meta: ... } or just array
        const courses = Array.isArray(coursesRes.data) ? coursesRes.data : (coursesRes.data.items || []);
        
        const existingCourse = courses.find(c => c.name === targetCourseName);
        if (existingCourse) {
            courseId = existingCourse.id;
            console.log(`Found existing course: ${targetCourseName} (${courseId})`);
        } else {
            console.log(`Creating course: ${targetCourseName}`);
            const createRes = await request('POST', '/courses', {
                name: targetCourseName,
                semester: '2025-Spring',
                status: 'ACTIVE'
            }, token);
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

    jsonData.courseId = courseId; // Override courseId

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
        // Maybe the payload is too large?
        if (e.message.includes('ECONNRESET')) {
             console.error('Connection reset. Payload might be too large for the server configuration.');
        }
    }
}

main();
