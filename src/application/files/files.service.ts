import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CreateFileDto } from "./dto/create-file.dto";
import { UpdateFileDto } from "./dto/update-file.dto";
import {
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  ListBucketsCommandOutput,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { DATABASE_CONNECTION } from "@/infrastructure/database/database.provider";
import type { Drizzle } from "@/interfaces/types/drizzle";
import { randomBytes } from "crypto";

@Injectable()
export class FilesService {
  private readonly s3Client: S3Client;

  private readonly configuration;
  constructor(
    private configService: ConfigService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: Drizzle
  ) {
    this.configuration = {
      region: "auto",
      endpoint: this.configService.get<string>("CLOUDFLARE_R2"),
      credentials: {
        accessKeyId: this.configService.get<string>("R2_ACCESS_KEY_ID"),
        secretAccessKey: this.configService.get<string>("R2_SECRET_ACCESS_KEY"),
      },
      bucket_name: this.configService.get<string>("R2_BUCKET_NAME"),
    };

    if (!this.configuration.bucket_name) {
      throw new Error("R2 bucket name (R2_BUCKET_NAME) is not configured");
    }

    if (!this.configuration.credentials.accessKeyId || !this.configuration.credentials.secretAccessKey) {
      throw new Error("R2 credentials (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) are not configured");
    }

    if (!this.configuration.endpoint) {
      throw new Error("R2 endpoint (CLOUDFLARE_R2) is not configured");
    }

    this.s3Client = new S3Client({
      region: "auto",
      endpoint: this.configuration.endpoint,
      forcePathStyle: true, // R2 prefers path-style for signed requests
      credentials: {
        accessKeyId: this.configuration.credentials.accessKeyId,
        secretAccessKey: this.configuration.credentials.secretAccessKey,
      },
    });
  }

  create(createFileDto: CreateFileDto) {
    return "This action adds a new file";
  }

  async uploadMultipleFiles(files: {
    events?: Express.Multer.File[];
    sub_events?: Express.Multer.File[];
    profile_image?: Express.Multer.File[];
    stateless?: Express.Multer.File[];
  }) {
    const uploadedFiles: string[] = [];
    console.log("🚀 ~ FilesService ~ uploadedFiles:", uploadedFiles);

    const generateRandomImageNameFromTimestamp = (): string => {
      const timestamp = Date.now();
      const randomString = randomBytes(8).toString("hex"); // Generate a random string of 16 characters (8 bytes)
      return `${timestamp}-${randomString}`;
    };

    const uploadFile = async (file: Express.Multer.File) => {
      const params = {
        Bucket: this.configuration.bucket_name,
        Key: `images/${generateRandomImageNameFromTimestamp()}-${file.originalname.trim().toLowerCase().replace(/\s+/g, "-")}`,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      try {
        const data = await this.s3Client.send(new PutObjectCommand(params));
        const fileUrl = `${this.configService.get<string>("R2_API")}/${params.Key}`;
        uploadedFiles.push(fileUrl);
        console.log("🚀 ~ FilesService ~ uploadFile ~ fileUrl:", fileUrl);
        console.log("Success", data);
      } catch (err) {
        console.log("Error", err);
        throw err;
      }
    };
    console.log("🚀 ~ FilesService ~ uploadFile ~ uploadFile:", uploadFile);

    try {
      if (files.events) {
        for (const file of files.events) {
          await uploadFile(file);
        }
      }
      if (files.sub_events) {
        for (const file of files.sub_events) {
          await uploadFile(file);
        }
      }
      if (files.profile_image) {
        for (const file of files.profile_image) {
          await uploadFile(file);
        }
      }
      if (files.stateless) {
        for (const file of files.stateless) {
          await uploadFile(file);
        }
      }
      console.log("🚀 ~ FilesService ~ uploadedFiles:", uploadedFiles);
      return uploadedFiles;
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }

  async uploadCsvFile(file: Express.Multer.File, type: "users" | "drivers" = "users") {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    if (!file.mimetype.includes("csv")) {
      throw new BadRequestException("Only CSV files are allowed");
    }

    const cleanName = file.originalname
      .trim()
      .toLowerCase()
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const prefix = type === "drivers" ? "csv/drivers/" : "csv/users/";
    const key = `${prefix}${Date.now()}-${randomBytes(6).toString("hex")}-${cleanName || "file"}.csv`;
    const params = {
      Bucket: this.configuration.bucket_name,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    try {
      await this.s3Client.send(new PutObjectCommand(params));
      const fileUrl = `${this.configService.get<string>("R2_API")}/${key}`;
      return { key, url: fileUrl };
    } catch (err) {
      console.log("Error uploading CSV", err);
      throw err;
    }
  }

  private async getCsvText(key: string): Promise<string> {
    const data = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.configuration.bucket_name, Key: key })
    );

    if (!data.Body) {
      throw new NotFoundException("CSV file not found");
    }

    return data.Body.transformToString("utf-8");
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    fields.push(current);
    return fields;
  }

  private parseCsvToJson(csvText: string): Record<string, string>[] {
    const lines = csvText.split(/\r?\n/).filter((line) => line.length > 0);
    if (!lines.length) return [];

    const headers = this.parseCsvLine(lines.shift() as string).map((h) => h.trim());

    return lines.map((line) => {
      const values = this.parseCsvLine(line).map((v) => v.trim());
      return headers.reduce<Record<string, string>>((acc, header, idx) => {
        acc[header] = values[idx] ?? "";
        return acc;
      }, {});
    });
  }

  async getCsvRecords(key: string): Promise<Record<string, string>[]> {
    const csvText = await this.getCsvText(key);
    return this.parseCsvToJson(csvText);
  }

  async getCsvRecordByIndex(key: string, index: number): Promise<Record<string, string>> {
    const records = await this.getCsvRecords(key);

    if (index < 0 || index >= records.length) {
      throw new NotFoundException(`Row ${index} not found`);
    }

    return records[index];
  }

  async listCsvFiles(sort: "asc" | "desc" = "desc") {
    const data = await this.s3Client.send(
      new ListObjectsV2Command({ Bucket: this.configuration.bucket_name, Prefix: "csv/" })
    );

    const items = (data.Contents || []).map((obj) => ({
      key: obj.Key,
      lastModified: obj.LastModified?.getTime() ?? null,
      size: obj.Size ?? null,
      url: obj.Key
        ? `${this.configService.get<string>("R2_API")}/${obj.Key.replace(/^csv\//, "csv/")}`
        : null,
    }));

    items.sort((a, b) => {
      const at = a.lastModified ?? 0;
      const bt = b.lastModified ?? 0;
      return sort === "asc" ? at - bt : bt - at;
    });

    return items;
  }

  async listCsvFilesByType(type: "users" | "drivers", sort: "asc" | "desc" = "desc") {
    const prefix = type === "drivers" ? "csv/drivers/" : "csv/users/";
    const data = await this.s3Client.send(
      new ListObjectsV2Command({ Bucket: this.configuration.bucket_name, Prefix: prefix })
    );

    const items = (data.Contents || []).map((obj) => ({
      key: obj.Key,
      lastModified: obj.LastModified?.getTime() ?? null,
      size: obj.Size ?? null,
      url: obj.Key
        ? `${this.configService.get<string>("R2_API")}/${obj.Key}`
        : null,
    }));

    items.sort((a, b) => {
      const at = a.lastModified ?? 0;
      const bt = b.lastModified ?? 0;
      return sort === "asc" ? at - bt : bt - at;
    });

    return items;
  }

  async createBucket(bucketName: string) {
    try {
      const data = await this.s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log("Success", data);
      return data;
    } catch (err) {
      console.log("Error creating bucket:", err.message);
      if (err.Code === "AccessDenied") {
        console.error("Access denied. Check your AWS credentials and permissions.");
      }
      throw err;
    }
  }

  async findAll(): Promise<ListBucketsCommandOutput> {
    try {
      const data = await this.s3Client.send(new ListBucketsCommand({}));
      console.log("Success", data.Buckets);
      return data;
    } catch (err) {
      console.log("Error listing buckets:", err.message);
      if (err.Code === "AccessDenied") {
        console.error("Access denied. Check your AWS credentials and permissions.");
      }
      throw err;
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} file`;
  }

  update(id: number, updateFileDto: UpdateFileDto) {
    return `This action updates a #${id} file`;
  }

  remove(id: number) {
    return `This action removes a #${id} file`;
  }
}
