import type { BrandedInjectionToken } from "@shared-kernel/types/branded-injection-token.js";

export interface Mailer {
  sendEmailWithTemplate(
    to: string,
    templateId: string,
    variables: Record<string, unknown>,
  ): Promise<void>;
}

export const MailerToken = Symbol("Mailer") as BrandedInjectionToken<Mailer>;
