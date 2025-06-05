import { describe, expect, it, vi } from 'vitest';
import { AuthenticationGuard } from './authentication.guard.js';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

describe('AuthenticationGuard', () => {
  describe('when the route is decorated with @Public', () => {
    it('should allow unauthenticated requests to access the route', () => {
      // Given
      const { context, guard, mockHasPublicDecorator } =
        createSystemUnderTest();

      mockHasPublicDecorator(true);

      // When
      const isAllowed = guard.canActivate(context);

      // Then
      expect(isAllowed).toBe(true);
    });
  });

  it('should not allow requests without a token to access private routes', () => {
    // Given
    const { context, guard, mockHttpRequest } = createSystemUnderTest();

    mockHttpRequest({ cookies: {} });

    // When
    const isAllowed = guard.canActivate(context);

    // Then
    expect(isAllowed).toBe(false);
  });

  it('should not allow requests with an invalid token to access private routes', () => {
    // Given
    const { context, guard, mockHttpRequest, mockJwtVerify } =
      createSystemUnderTest();

    mockHttpRequest({ cookies: { token: 'invalid-token' } });
    mockJwtVerify({});

    // When
    const isAllowed = guard.canActivate(context);

    // Then
    expect(isAllowed).toBe(false);
  });

  it('should allow requests with a valid token to access private routes', () => {
    // Given
    const { context, guard, mockHttpRequest, mockJwtVerify } =
      createSystemUnderTest();

    mockHttpRequest({ cookies: { token: 'valid-token' } });
    mockJwtVerify({ sub: 'account-id' });

    // When
    const isAllowed = guard.canActivate(context);

    // Then
    expect(isAllowed).toBe(true);
  });

  it('should inject the token claims into the request object', () => {
    // Given
    const { context, guard, mockHttpRequest, mockJwtVerify } =
      createSystemUnderTest();

    mockHttpRequest({ cookies: { token: 'valid-token' } });
    mockJwtVerify({ sub: 'account-id' });

    // When
    guard.canActivate(context);

    // Then
    const request = context.switchToHttp().getRequest();
    expect(request).toMatchObject({
      account: {
        id: 'account-id',
      },
    });
  });
});

function createSystemUnderTest() {
  // ExecutionContext (from NestJS)
  const mockedGetRequest = vi.fn().mockReturnValue({ cookies: {} });
  const mockedSwitchToHttp = vi
    .fn()
    .mockReturnValue({ getRequest: mockedGetRequest });

  // Reflector (from NestJS)
  const mockedGetAllAndOverride = vi.fn();

  // JwtService
  const mockedJwtSign = vi.fn();
  const mockedJwtVerify = vi.fn();

  const guard = new AuthenticationGuard(
    {
      sign: mockedJwtSign,
      verify: mockedJwtVerify,
    },
    {
      getAllAndOverride: mockedGetAllAndOverride,
    } as unknown as Reflector,
  );

  return {
    context: {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: mockedSwitchToHttp,
    } as unknown as ExecutionContext,
    guard,

    mockHasPublicDecorator: (value: boolean) =>
      mockedGetAllAndOverride.mockReturnValueOnce(value),

    mockHttpRequest: (request: Partial<Request>) =>
      mockedGetRequest.mockReturnValue(request),

    mockJwtVerify: (claims: Record<string, unknown>) =>
      mockedJwtVerify.mockReturnValueOnce(claims),
  };
}
