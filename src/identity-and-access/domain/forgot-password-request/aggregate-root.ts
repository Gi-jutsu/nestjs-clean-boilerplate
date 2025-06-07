import { AggregateRoot } from '@core/primitives/aggregate-root.js';
import { DateTime } from 'luxon';
import { ForgotPasswordRequestCreatedDomainEvent } from './events/forgot-password-request-created.domain-event.js';
import { ForgotPasswordRequestRefreshedDomainEvent } from './events/forgot-password-request-refreshed.domain-event.js';

interface Properties {
  accountId: string;
  token: string;
  expiresAt: DateTime;
}

interface CreateProperties {
  accountId: string;
}

export class ForgotPasswordRequest extends AggregateRoot<Properties> {
  static create(properties: CreateProperties) {
    const token = Math.random().toString(36).slice(2);
    const forgotPasswordRequest = new ForgotPasswordRequest({
      properties: {
        accountId: properties.accountId,
        token,
        expiresAt: DateTime.now().plus({ days: 1 }),
      },
    });

    forgotPasswordRequest.commit(
      new ForgotPasswordRequestCreatedDomainEvent({
        payload: forgotPasswordRequest.properties,
      }),
    );

    return forgotPasswordRequest;
  }

  refresh() {
    this._properties.token = Math.random().toString(36).slice(2);
    this._properties.expiresAt = DateTime.now().plus({ days: 1 });

    this.commit(
      new ForgotPasswordRequestRefreshedDomainEvent({
        payload: this.properties,
      }),
    );
  }
}
