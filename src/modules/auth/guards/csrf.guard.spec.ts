import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const buildContext = (
    overrides: Partial<{
      method: string;
      cookies: Record<string, string>;
      headers: Record<string, string>;
    }> = {},
  ): ExecutionContext => {
    const req = {
      method: overrides.method ?? 'POST',
      cookies: overrides.cookies ?? {},
      headers: overrides.headers ?? {},
      originalUrl: '/treinos/1',
    };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    guard = new CsrfGuard(reflector as unknown as Reflector);
    delete process.env.CSRF_ENFORCE;
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows safe methods without checking tokens', () => {
    const ctx = buildContext({ method: 'GET' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows public/skip-csrf routes regardless of token', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true); // isPublic
    const ctx = buildContext({ method: 'POST' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows the request in observation mode (CSRF_ENFORCE unset) even without a matching token', () => {
    const ctx = buildContext({ method: 'POST' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks a mutating request without a matching token when enforcing', () => {
    process.env.CSRF_ENFORCE = 'true';
    const ctx = buildContext({ method: 'POST' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('blocks when cookie and header csrf tokens diverge while enforcing', () => {
    process.env.CSRF_ENFORCE = 'true';
    const ctx = buildContext({
      method: 'POST',
      cookies: { csrf_token: 'abc' },
      headers: { 'x-csrf-token': 'def' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows when cookie and header csrf tokens match while enforcing', () => {
    process.env.CSRF_ENFORCE = 'true';
    const ctx = buildContext({
      method: 'POST',
      cookies: { csrf_token: 'abc' },
      headers: { 'x-csrf-token': 'abc' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks in production even without CSRF_ENFORCE explicitly set', () => {
    process.env.NODE_ENV = 'production';
    const ctx = buildContext({ method: 'POST' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
