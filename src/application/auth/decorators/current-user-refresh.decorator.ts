import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RefreshAuthGuard } from "../guards/refresh.guards";
export const CurrentRefreshUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return RefreshAuthGuard.getUserFromRequestRefresh(request);
});
