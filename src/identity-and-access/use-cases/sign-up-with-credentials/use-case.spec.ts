import { ResourceAlreadyExistsError } from '@shared-kernel/domain/errors/resource-already-exists.error.js';
import { FakePasswordHasher } from '@identity-and-access/infrastructure/fake-password-hasher.js';
import { InMemoryAccountRepository } from '@identity-and-access/infrastructure/repositories/in-memory-account.repository.js';
import { DateTime, Settings } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SignUpWithCredentialsUseCase } from './use-case.js';
import { OutboxDomainEventPublisher } from '@shared-kernel/infrastructure/outbox-domain-event-publisher.adapter.js';
import { InMemoryOutboxMessageRepository } from '@shared-kernel/infrastructure/repositories/in-memory-outbox-message.repository.js';

describe('SignUpWithCredentialsUseCase', () => {
  beforeAll(() => {
    Settings.now = () => new Date(0).getMilliseconds();
  });

  afterAll(() => {
    Settings.now = () => Date.now();
  });

  it('should throw a ResourceAlreadyExists when the email is already taken', async () => {
    // Given
    const { allAccounts, useCase } = createSystemUnderTest();

    const account = {
      email: 'dylan@call-me-dev.com',
      id: '1',
      password: 'password',
    };

    allAccounts.snapshots.set(account.id, account);

    try {
      // When
      await useCase.execute({
        email: 'dylan@call-me-dev.com',
        password: 'wrong-password',
      });

      expect(true).toBe(false);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ResourceAlreadyExistsError);
      expect(error).toMatchObject({
        status: 409,
        code: 'resource-already-exists',
        title: 'Resource Already Exists',
        detail: 'The Account you are trying to create already exists.',
        timestamp: DateTime.now(),
        pointer: '/data/attributes/email',
        conflictingFieldName: 'email',
        conflictingFieldValue: 'dylan@call-me-dev.com',
        resource: 'Account',
      });
    }
  });

  it('should create an unverified account with a hashed password', async () => {
    // Given
    const { allAccounts, useCase } = createSystemUnderTest();

    const credentials = {
      email: 'dylan@call-me-dev.com',
      password: 'password',
    };

    // When
    const { account } = await useCase.execute(credentials);

    // Then
    const snapshots = [...allAccounts.snapshots.values()];
    expect(snapshots).toEqual([
      {
        id: account.id,
        email: credentials.email,
        isEmailVerified: false,
        password: 'hashed-password',
      },
    ]);
  });
});

function createSystemUnderTest() {
  const allOutboxMessages = new InMemoryOutboxMessageRepository();
  const outboxDomainEventPublisher = new OutboxDomainEventPublisher(
    allOutboxMessages,
  );

  const allAccounts = new InMemoryAccountRepository(outboxDomainEventPublisher);
  const fakePasswordHasher = new FakePasswordHasher();

  const useCase = new SignUpWithCredentialsUseCase(
    allAccounts,
    fakePasswordHasher,
  );

  return { allAccounts, fakePasswordHasher, useCase };
}
