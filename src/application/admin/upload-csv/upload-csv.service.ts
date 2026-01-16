import { Injectable } from "@nestjs/common";
import { FilesService } from "@/application/files/files.service";

@Injectable()
export class UploadCsvService {
  constructor(private readonly filesService: FilesService) {}

  upload(file: Express.Multer.File) {
    return this.filesService.uploadCsvFile(file);
  }

  uploadByType(file: Express.Multer.File, type: "users" | "drivers") {
    return this.filesService.uploadCsvFile(file, type);
  }

  getAll(key: string) {
    return this.filesService.getCsvRecords(key);
  }

  getOne(key: string, index: number) {
    return this.filesService.getCsvRecordByIndex(key, index);
  }

  list(sort: "asc" | "desc" = "desc") {
    return this.filesService.listCsvFiles(sort);
  }

  listByType(type: "users" | "drivers", sort: "asc" | "desc" = "desc") {
    return this.filesService.listCsvFilesByType(type, sort);
  }
}
