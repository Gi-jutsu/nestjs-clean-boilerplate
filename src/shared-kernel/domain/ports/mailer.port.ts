export interface Mailer {
  sendEmailWithTemplate(
    to: string,
    templateId: string,
    variables: Record<string, unknown>,
  ): Promise<void>;
}

export const MailerToken = Symbol('Mailer');
