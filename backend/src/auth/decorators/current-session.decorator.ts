import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentSessionId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.sessionId || request.user?.sessionId || null;
  },
);
