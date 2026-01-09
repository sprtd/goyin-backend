import { Module } from '@nestjs/common';
import connectionProvider, { DATABASE_CONNECTION } from './database.provider';

@Module({
  providers: [connectionProvider],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
