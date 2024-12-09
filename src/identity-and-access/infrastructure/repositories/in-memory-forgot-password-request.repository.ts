import type { ForgotPasswordRequest } from "@identity-and-access/domain/forgot-password-request/aggregate-root.js";
import type { ForgotPasswordRequestRepository } from "@identity-and-access/domain/forgot-password-request/repository.js";

export class InMemoryForgotPasswordRequestRepository
  implements ForgotPasswordRequestRepository
{
  snapshots = new Map();

  async hasPendingRequest(accountId: string): Promise<boolean> {
    return [...this.snapshots.values()].some(
      (request) => request.accountId === accountId
    );
  }

  async save(request: ForgotPasswordRequest): Promise<void> {
    this.snapshots.set(request.id, request.properties);
  }
}
