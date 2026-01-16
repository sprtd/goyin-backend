import { Module } from "@nestjs/common";
import { SurveySyncService } from "./survey-sync.service";
import { SurveyController } from "./survey.controller";
import { FilesModule } from "@/application/files/files.module";
import { DatabaseModule } from "@/infrastructure/database/database.module";

@Module({
  imports: [FilesModule, DatabaseModule],
  controllers: [SurveyController],
  providers: [SurveySyncService],
  exports: [SurveySyncService],
})
export class SurveySyncModule {}
