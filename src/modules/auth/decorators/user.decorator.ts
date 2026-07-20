import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: number;
  role: 'PERSONAL' | 'ALUNO';
}

export const User = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
