import { Module } from '@nestjs/common';
import { PostgresKeyModule } from './common/database/postgres.module';
import { StorageModule } from './common/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PostgresKeyModule, StorageModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AuthAppModule {}
