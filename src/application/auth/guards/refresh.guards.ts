import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from '@/interfaces/types/users/jwt.type';
import { ConfigService } from '@nestjs/config';
import { CustomResponseInterceptor } from '@/interceptors/api-response.interceptor';

@Injectable()
@UseInterceptors(CustomResponseInterceptor)
export class RefreshAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const refreshTokenSecret =
        this.configService.get<JwtVerifyOptions>('refresh-jwt');

      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        token,
        refreshTokenSecret,
      );
      // 💡 We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      request['user'] = { ...payload, token: token };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  static getUserFromRequestRefresh(request: Request) {
    return request['user'];
  }
}
