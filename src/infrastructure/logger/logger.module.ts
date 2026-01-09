import { Module } from '@nestjs/common';
import * as FileStreamRotator from 'file-stream-rotator';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        //level: 'error',
        autoLogging: false,
        redact: ['access_token', 'req_headers'], //sensitive details to ignore incase log file is stolen
        useLevel: 'fatal',
        stream: FileStreamRotator.getStream({
          filename: './tmp/chat/test-%DATE%.log',
          frequency: 'daily',
          verbose: false,
          date_format: 'YYYY-MM-DD',
          size: '5M',
        }),
      },
    }),
  ],
})
export class LoggerModule {}
