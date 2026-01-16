import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "../guards/auth.guards";

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return AuthGuard.getUserFromRequest(request);
});
