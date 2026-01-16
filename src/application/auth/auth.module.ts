import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UsersService } from "../users/users.service";
import { DatabaseModule } from "@/infrastructure/database/database.module";
import { JwtModule } from "@nestjs/jwt";
import accessJwt from "./config/access-jwt";
import { ConfigModule } from "@nestjs/config";
import refreshJwt from "./config/refresh-jwt";
import { FilesService } from "../files/files.service";

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync(accessJwt.asProvider()),
    ConfigModule.forFeature(refreshJwt),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, FilesService],
})
export class AuthModule {}
