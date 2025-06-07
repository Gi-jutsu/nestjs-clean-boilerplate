import { EnvironmentKeys } from '@core/environment.js';
import { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcessOutboxMessagesUseCase } from './use-case.js';

export class ProcessOutboxMessagesScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private _intervalId: NodeJS.Timeout;
  private readonly _interval: number;

  constructor(
    private readonly config: ConfigService,
    private readonly useCase: ProcessOutboxMessagesUseCase,
  ) {
    this._interval = this.config.getOrThrow(
      EnvironmentKeys.OUTBOX_PROCESSING_INTERVAL,
    );
  }

  async handle() {
    await this.useCase.execute();
  }

  onApplicationBootstrap() {
    this._intervalId = setInterval(() => this.handle(), this._interval);
  }

  onApplicationShutdown() {
    clearInterval(this._intervalId);
  }
}
