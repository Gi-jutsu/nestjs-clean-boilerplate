import type { ConfigService } from '@nestjs/config';
import type { Mailer } from '@shared-kernel/domain/ports/mailer.port.js';

export class SendForgotPasswordEmailUseCase {
  constructor(
    private readonly config: ConfigService,
    private readonly mailer: Mailer,
  ) {}

  async execute(command: SendForgotPasswordEmailCommand) {
    const baseApiUrl = this.config.getOrThrow('API_BASE_URL');

    await this.mailer.sendEmailWithTemplate(
      command.account.email,
      'forgot-password',
      {
        link: `${baseApiUrl}/reset-password?token=${command.forgotPasswordRequest.token}`,
      },
    );
  }
}

type SendForgotPasswordEmailCommand = {
  account: {
    email: string;
  };
  forgotPasswordRequest: {
    token: string;
  };
};
