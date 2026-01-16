import { CustomResponseInterceptor } from "@/interceptors/api-response.interceptor";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { FilesService } from "./files.service";
import { CreateFileDto } from "./dto/create-file.dto";
import { UpdateFileDto } from "./dto/update-file.dto";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";

@Controller("files")
@UseInterceptors(CustomResponseInterceptor)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  create(@Body() createFileDto: CreateFileDto) {
    return this.filesService.create(createFileDto);
  }

  @Post("create-bucket")
  createBucket(@Body() bucket_name: string) {
    return this.filesService.createBucket(bucket_name);
  }
  @Post("upload")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "events", maxCount: 3 },
      { name: "sub_events", maxCount: 3 },
      { name: "profile_image", maxCount: 1 },
      { name: "stateless", maxCount: 10 },
    ])
  )
  uploadFile(
    @UploadedFiles()
    files: {
      events?: Express.Multer.File[];
      sub_events?: Express.Multer.File[];
      profile_image?: Express.Multer.File[];
      stateless?: Express.Multer.File[];
    }
  ) {
    console.log("🚀 ~ FilesController ~ files:", files);
    return this.filesService.uploadMultipleFiles(files);
  }

  @Get()
  findAll() {
    return this.filesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.filesService.findOne(+id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateFileDto: UpdateFileDto) {
    return this.filesService.update(+id, updateFileDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.filesService.remove(+id);
  }
}
