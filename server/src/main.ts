import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AccountType, UserEntity, UserRole, UserStatus } from './modules/auth/entities/user.entity';
import { json, urlencoded } from 'express';
import * as express from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { collectDefaultMetrics, Histogram, register } from 'prom-client';

async function seedTestUser(dataSource: DataSource) {
  if (process.env.SEED_TEST_USER !== 'true') {
    return; 
  }

  // If migrations haven't run yet, the users table may not exist.
  // In that case, skip seeding to avoid crashing on startup.
  const tableExistsResult = await dataSource.query(
    `SELECT to_regclass('public.users') AS exists`,
  );
  const tableExists = Boolean(tableExistsResult?.[0]?.exists);
  if (!tableExists) {
    // eslint-disable-next-line no-console
    console.log(
      '[seed] Skipping test user seed because table "public.users" does not exist. Run migrations first.',
    );
    return;
  }

  const schoolId = process.env.SEED_SCHOOL_ID ?? 'test-school';
  const account = process.env.SEED_ACCOUNT ?? 'admin';
  const password = process.env.SEED_PASSWORD ?? 'admin123456';
  const accountType = AccountType.USERNAME;

  const userRepo = dataSource.getRepository(UserEntity);
  const existing = await userRepo.findOne({
    where: { schoolId, accountType, account },
  });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log(
      `[seed] Test user already exists: ${schoolId}/${accountType}/${account}`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = userRepo.create({
    id: randomUUID(),
    schoolId,
    accountType,
    account,
    email: process.env.SEED_EMAIL ?? 'admin@example.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    name: process.env.SEED_NAME ?? 'Test Admin',
    passwordHash,
  });

  await userRepo.save(user);
  // eslint-disable-next-line no-console
  console.log(
    `[seed] Created test user: schoolId=${schoolId}, accountType=${accountType}, account=${account}, password=${password}`,
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  const metricsEnabled = process.env.ENABLE_METRICS !== 'false';
  if (metricsEnabled) {
    collectDefaultMetrics();
    const httpHistogram = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in ms',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    });

    app.use((req, res, next) => {
      if (req.path === '/metrics') {
        return next();
      }
      const end = httpHistogram.startTimer({
        method: req.method,
        route: req.path,
      });
      res.on('finish', () => {
        end({ status_code: res.statusCode });
      });
      next();
    });

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/metrics', async (_req: any, res: any) => {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    });
  }
  const cwdUploads = join(process.cwd(), 'uploads');
  const repoUploads = join(process.cwd(), 'server', 'uploads');
  const uploadRoot = existsSync(cwdUploads) ? cwdUploads : repoUploads;
  app.use('/uploads', express.static(uploadRoot));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('AI作业批改系统API')
    .setDescription('接口文档')
    .setVersion('1.0')
    .addServer('/api/v1')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await seedTestUser(app.get(DataSource));
  await app.listen(3000);
}
void bootstrap();
