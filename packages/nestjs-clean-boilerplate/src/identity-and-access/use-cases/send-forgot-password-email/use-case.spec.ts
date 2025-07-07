import { ConfigService } from '@nestjs/config';
import { Settings } from 'luxon';
import { afterAll, beforeAll, describe, expect, it, vitest } from 'vitest';
import { SendForgotPasswordEmailUseCase } from './use-case.js';

describe('SendForgotPasswordEmailUseCase', () => {
  beforeAll(() => {
    Settings.now = () => new Date(0).getMilliseconds();
  });

  afterAll(() => {
    Settings.now = () => Date.now();
  });

  it('should send an email with the link to reset the password', async () => {
    // Given
    const { spyMailer, useCase } = createSystemUnderTest();

    // When
    await useCase.execute({
      account: {
        email: 'dylan@call-me-dev.com',
      },
      forgotPasswordRequest: {
        token: 'fake-token',
      },
    });

    // Then
    expect(spyMailer.sendEmailWithTemplate).toHaveBeenCalledWith(
      'dylan@call-me-dev.com',
      'forgot-password',
      {
        link: 'http://127.0.0.1:8080/reset-password?token=fake-token',
      },
    );
  });
});

function createSystemUnderTest() {
  const fakeConfig = new ConfigService();
  fakeConfig.getOrThrow = (key: string) => {
    if (key === 'API_BASE_URL') return 'http://127.0.0.1:8080';
    throw new Error(`Key ${key} not found`);
  };

  const spyMailer = {
    sendEmailWithTemplate: vitest.fn(),
  };

  const useCase = new SendForgotPasswordEmailUseCase(fakeConfig, spyMailer);

  return { spyMailer, useCase };
}
