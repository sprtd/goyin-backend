import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadCsvService } from "./upload-csv.service";

@Controller("upload-csv")
export class UploadCsvController {
  constructor(private readonly uploadCsvService: UploadCsvService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  uploadCsv(@UploadedFile() file: Express.Multer.File) {
    return this.uploadCsvService.upload(file);
  }

  @Post("users")
  @UseInterceptors(FileInterceptor("file"))
  uploadUsersCsv(@UploadedFile() file: Express.Multer.File) {
    return this.uploadCsvService.uploadByType(file, "users");
  }

  @Post("drivers")
  @UseInterceptors(FileInterceptor("file"))
  uploadDriversCsv(@UploadedFile() file: Express.Multer.File) {
    return this.uploadCsvService.uploadByType(file, "drivers");
  }

  @Get()
  listCsv(@Query("sort") sort: "asc" | "desc" = "desc") {
    return this.uploadCsvService.list(sort === "asc" ? "asc" : "desc");
  }

  @Get("users")
  listUsersCsv(@Query("sort") sort: "asc" | "desc" = "desc") {
    return this.uploadCsvService.listByType("users", sort === "asc" ? "asc" : "desc");
  }

  @Get("drivers")
  listDriversCsv(@Query("sort") sort: "asc" | "desc" = "desc") {
    return this.uploadCsvService.listByType("drivers", sort === "asc" ? "asc" : "desc");
  }

  @Get(":key")
  getCsv(@Param("key") key: string) {
    return this.uploadCsvService.getAll(key);
  }

  @Get(":key/rows/:index")
  getCsvRow(@Param("key") key: string, @Param("index", ParseIntPipe) index: number) {
    return this.uploadCsvService.getOne(key, index);
  }
}
