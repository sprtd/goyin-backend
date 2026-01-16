import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { LoggerModule } from "./infrastructure/logger";
import { UploadCsvModule } from "./application/admin/upload-csv/upload-csv.module";
import { SurveySyncModule } from "./application/admin/survey-sync/survey-sync.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    LoggerModule,
    UploadCsvModule,
    SurveySyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
