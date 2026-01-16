import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule as LoggerModulePino } from "nestjs-pino";
import * as FileStreamRotator from "file-stream-rotator";
import pino from "pino";
import pinoPretty from "pino-pretty";

@Module({
  imports: [
    LoggerModulePino.forRootAsync({
      // imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = process.env.NODE_ENV === "production";
        const redactedFields: string[] = [
          "access_token",
          "req_headers",
          "req.headers.authorization",
          "req.headers.Authorization",
        ];
        const fileStream = FileStreamRotator.getStream({
          filename: "./tmp/test-%DATE%.log",
          frequency: "daily",
          verbose: false,
          date_format: "YYYY-MM-DD",
          size: "5M",
        });

        const pinoBaseConfig = {
          level: configService.get("LOG_LEVEL"),
          //   autoLogging: false,
          redact: redactedFields, //sensitive details to ignore incase log file is stolen
        };

        if (isProduction) {
          return {
            pinoHttp: {
              ...pinoBaseConfig,
              stream: fileStream,
            },
          };
        }

        const prettyStream = pinoPretty({
          colorize: true,
          singleLine: true,
        });
        prettyStream.pipe(process.stdout);

        return {
          pinoHttp: {
            ...pinoBaseConfig,
            stream: pino.multistream([{ stream: fileStream }, { stream: prettyStream }]),
          },
        };
      },
    }),
  ],
  exports: [LoggerModulePino],
})
export class LoggerModule {}
