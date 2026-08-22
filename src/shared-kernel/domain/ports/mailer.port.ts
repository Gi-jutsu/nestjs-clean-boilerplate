import type { BrandedInjectionToken } from "@packages/nest-provider-factory";

export interface Mailer {
  sendEmailWithTemplate(
    to: string,
    templateId: string,
    variables: Record<string, unknown>,
  ): Promise<void>;
}

export const MailerToken = Symbol("Mailer") as BrandedInjectionToken<Mailer>;
