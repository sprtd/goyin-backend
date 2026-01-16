import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, LoggerErrorInterceptor } from "nestjs-pino";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { VersioningType } from "@nestjs/common";
import { CustomResponseInterceptor } from "./interceptors/api-response.interceptor";

async function bootstrap() {
  console.log("🚀 [Main] Application starting...");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    forceCloseConnections: true,
    rawBody: true,
  });
  app.enableShutdownHooks();
  app.enableCors({ origin: "*" });
  // set global prefix as this is the version 2
  // app.setGlobalPrefix('v1');
  app.enableVersioning({
    type: VersioningType.URI, // URLs like /v2/users, /v3/users
    defaultVersion: "1", // fallback if version not specified
  });

  app.useStaticAssets(join(__dirname, "..", "src", "assets", "public"));
  app.setBaseViewsDir(join(__dirname, "..", "src", "assets", "views"));
  app.setViewEngine("hbs");
  // app.use('/static', express.static(join(__dirname, '..', 'public')));
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor(), new CustomResponseInterceptor());
  await app.listen(process.env.PORT || 8088);

  console.log(`🚀 [Main] Application is running on: ${await app.getUrl()}`);
  // configure logger
}
void bootstrap();
