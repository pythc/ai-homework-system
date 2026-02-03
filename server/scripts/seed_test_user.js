const { Client } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function seed() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || '123456',
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    const passwordHash = await bcrypt.hash('123456', 10);
    // Fixed UUIDs for reproducibility
    const userId = '11111111-1111-1111-1111-111111111111';
    const courseId = '22222222-2222-2222-2222-222222222222';

    // 1. Upsert User
    const checkQuery = `SELECT * FROM users WHERE school_id = $1 AND account = $2`;
    const checkRes = await client.query(checkQuery, ['test-school', 'admin']);

    let finalUserId = userId;

    if (checkRes.rows.length > 0) {
      console.log('User admin/test-school exists. Updating...');
      finalUserId = checkRes.rows[0].id;
      await client.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [passwordHash, finalUserId]
      );
    } else {
      console.log('Creating user admin/test-school...');
      const insertQuery = `
        INSERT INTO users (id, school_id, account_type, account, role, status, password_hash, name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await client.query(insertQuery, [
        userId,
        'test-school',
        'USERNAME',
        'admin',
        'TEACHER',
        'ACTIVE',
        passwordHash,
        'Test Teacher'
      ]);
    }

    // 2. Upsert Course
    const courseCheck = await client.query(`SELECT * FROM courses WHERE id = $1`, [courseId]);
    if (courseCheck.rows.length === 0) {
       console.log(`Creating course ${courseId}...`);
       // courses(id, school_id, name, semester, teacher_id, status)
       await client.query(`
         INSERT INTO courses (id, school_id, name, semester, teacher_id, status)
         VALUES ($1, $2, $3, $4, $5, $6)
       `, [courseId, 'test-school', 'Algorithm 101', '2025-Fall', finalUserId, 'ACTIVE']);
    } else {
       console.log('Course already exists.');
    }

    console.log('Done.');
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

seed();
