import type { SharedKernelDatabaseTransaction } from '@shared-kernel/infrastructure/database/drizzle.schema.js';

export class HealthCheckUseCase {
  constructor(
    private readonly database: SharedKernelDatabaseTransaction,
    private readonly process: NodeJS.Process,
  ) {}

  async execute() {
    const isPostgresqlAvailable = await this.isPostgresqlAvailable();

    return {
      status: 'pass',
      checks: {
        postgresql: {
          status: isPostgresqlAvailable ? 'pass' : 'fail',
        },
        uptime: [
          {
            componentType: 'system',
            observedValue: this.process.uptime(),
            observedUnit: 's',
            status: 'pass',
          },
        ],
      },
    };
  }

  private async isPostgresqlAvailable() {
    try {
      await this.database.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
