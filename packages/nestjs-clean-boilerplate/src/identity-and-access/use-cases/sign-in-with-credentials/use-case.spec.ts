import { Account } from '@identity-and-access/domain/account/aggregate-root.js';
import { FakePasswordHasher } from '@identity-and-access/infrastructure/fake-password-hasher.js';
import { InMemoryAccountRepository } from '@identity-and-access/infrastructure/repositories/in-memory-account.repository.js';
import { OutboxDomainEventPublisher } from '@shared-kernel/infrastructure/outbox-domain-event-publisher.adapter.js';
import { InMemoryOutboxMessageRepository } from '@shared-kernel/infrastructure/repositories/in-memory-outbox-message.repository.js';
import { DateTime, Settings } from 'luxon';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SignInWithCredentialsUseCase } from './use-case.js';

describe('SignInWithCredentialsUseCase', () => {
  beforeAll(() => {
    Settings.now = () => new Date(0).getMilliseconds();
  });

  afterAll(() => {
    Settings.now = () => Date.now();
  });

  it('should throw a ResourceNotFoundError when the user does not exist', async () => {
    // Given
    const { useCase } = createSystemUnderTest();

    const credentials = {
      email: 'dylan@call-me-dev.com',
      password: 'password',
    };

    // When
    const promise = useCase.execute(credentials);

    // Then
    await expect(promise).rejects.toMatchObject({
      status: 404,
      code: 'resource-not-found',
      title: 'Resource Not Found',
      detail: 'The Account you are trying to access does not exist.',
      timestamp: DateTime.now(),
      pointer: '/data/attributes/email',
    });
  });

  it('should throw a WrongPasswordError when the password is incorrect', async () => {
    // Given
    const { allAccounts, useCase } = createSystemUnderTest();

    const account = {
      email: 'dylan@call-me-dev.com',
      id: '1',
      password: 'hashed-password',
    };

    allAccounts.snapshots.set(account.id, account);

    // When
    const promise = useCase.execute({
      email: account.email,
      password: 'wrong-password',
    });

    // Then
    await expect(promise).rejects.toMatchObject({
      status: 401,
      code: 'wrong-password',
      title: 'Unauthorized',
      detail: 'The password you entered is incorrect. Please try again.',
      timestamp: DateTime.now(),
      pointer: '/data/attributes/password',
    });
  });

  it('should return an access token with claims when the credentials are correct', async () => {
    // Given
    const { allAccounts, jwt, useCase } = createSystemUnderTest();

    const account = Account.fromSnapshot({
      email: 'dylan@call-me-dev.com',
      id: '1',
      isEmailVerified: true,
      password: 'hashed-password',
    });

    allAccounts.snapshots.set(account.id, account.properties);

    // When
    await useCase.execute({
      email: 'dylan@call-me-dev.com',
      password: 'password',
    });

    // Then
    expect(jwt.sign).toHaveBeenNthCalledWith(1, { sub: account.id });
  });
});

function createSystemUnderTest() {
  const allOutboxMessages = new InMemoryOutboxMessageRepository();
  const outboxDomainEventPublisher = new OutboxDomainEventPublisher(
    allOutboxMessages,
  );

  const allAccounts = new InMemoryAccountRepository(outboxDomainEventPublisher);
  const jwt = {
    sign: vi.fn(),
    verify: vi.fn(),
  };
  const passwordHasher = new FakePasswordHasher();

  const useCase = new SignInWithCredentialsUseCase(
    allAccounts,
    jwt,
    passwordHasher,
  );

  return {
    allAccounts,
    jwt,
    passwordHasher,
    useCase,
  };
}
