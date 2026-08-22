import { describe, expect, it, vitest } from "vitest";
import { ProcessOutboxMessagesDomainEventController } from "@packages/outbox/use-cases/process-outbox-messages/domain-event.controller.js";
import type { ProcessOutboxMessagesUseCase } from "@packages/outbox/use-cases/process-outbox-messages/use-case.js";

describe("ProcessOutboxMessagesDomainEventController", () => {
  it("should process queued outbox messages", async () => {
    const system = createSystemUnderTest();

    await system.when.outboxMessagesAreQueued();

    system.then.queuedMessagesShouldBeProcessed();
  });
});

function createSystemUnderTest() {
  const useCase = {
    execute: vitest.fn(),
  };

  const processOutboxMessages = new ProcessOutboxMessagesDomainEventController(
    useCase as unknown as ProcessOutboxMessagesUseCase,
  );

  return {
    when: {
      async outboxMessagesAreQueued() {
        await processOutboxMessages.handle();
      },
    },
    then: {
      queuedMessagesShouldBeProcessed() {
        expect(useCase.execute).toHaveBeenCalledOnce();
      },
    },
  };
}
