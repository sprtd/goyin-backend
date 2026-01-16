/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private readonly logger = new Logger(R2Service.name);
  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: this.configService.getOrThrow<string>("CLOUDFLARE_R2"),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>("R2_ACCESS_KEY_ID"),
        secretAccessKey: this.configService.getOrThrow<string>("R2_SECRET_ACCESS_KEY"),
      },
    });
    this.logger.debug("R2 S3 Client initialized", {
      endpoint: this.configService.getOrThrow<string>("CLOUDFLARE_R2"),
    });
  }

  exposeR2Credentials = () => {
    this.logger.debug("Exposing R2 credentials");
    return this.s3Client;
  };

  getBucketName = () => {
    return this.configService.getOrThrow<string>("R2_BUCKET_NAME");
  };
}
