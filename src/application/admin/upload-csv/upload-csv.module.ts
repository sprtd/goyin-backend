import { Module } from "@nestjs/common";
import { UploadCsvService } from "./upload-csv.service";
import { UploadCsvController } from "./upload-csv.controller";
import { FilesModule } from "@/application/files/files.module";

@Module({
  imports: [FilesModule],
  controllers: [UploadCsvController],
  providers: [UploadCsvService],
})
export class UploadCsvModule {}
