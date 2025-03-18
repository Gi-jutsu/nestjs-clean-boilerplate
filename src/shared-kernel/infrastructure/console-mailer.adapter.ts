import { Logger } from '@nestjs/common';
import { Mailer } from '@shared-kernel/domain/ports/mailer.port.js';

export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger(ConsoleMailer.name);

  async sendEmailWithTemplate(to: string, templateId: string, variables: Record<string, unknown>) {
    this.logger.log(
      `Sending email to ${to} using template ${templateId} with variables: ${JSON.stringify(
        variables,
      )}`,
    );
  }
}
