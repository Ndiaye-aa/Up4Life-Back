import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Reflector.getAllAndOverride prioriza metadata do handler sobre a da classe,
// então isso permite "revogar" o @Public() de classe em uma rota específica
// (ex: /auth/refresh, /auth/logout, /auth/me em um controller @Public()).
export const RequireAuth = () => SetMetadata(IS_PUBLIC_KEY, false);
