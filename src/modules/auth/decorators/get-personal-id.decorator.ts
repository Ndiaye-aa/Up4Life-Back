import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from './user.decorator';

export const GetPersonalId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    return request.user?.id;
  },
);
