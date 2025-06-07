import { AggregateRoot } from '@core/primitives/aggregate-root.js';
import { NewAccountRegisteredDomainEvent } from './events/new-account-registered.js';

interface Properties {
  email: string;
  isEmailVerified: boolean;
  password: string;
}

interface CreateProperties {
  email: string;
  password: string;
}

export class Account extends AggregateRoot<Properties> {
  static create(properties: CreateProperties) {
    const account = new Account({
      properties: {
        ...properties,
        isEmailVerified: false,
      },
    });

    account.commit(
      new NewAccountRegisteredDomainEvent({
        payload: {
          email: account.properties.email,
        },
      }),
    );

    return account;
  }
}
