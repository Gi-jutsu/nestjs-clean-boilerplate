import { CodeReviewRequest } from "../../../domain/code-review-request/aggregate-root.js";
import type { CodeReviewRequestRepository } from "../../../domain/code-review-request/repository.js";

export class InMemoryCodeReviewRequestRepository
  implements CodeReviewRequestRepository
{
  public readonly requests: CodeReviewRequest[] = [];

  save(request: CodeReviewRequest): Promise<void> {
    this.requests.push(request);
    return Promise.resolve();
  }
}
