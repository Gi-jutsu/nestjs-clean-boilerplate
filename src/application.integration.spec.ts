import { Server } from "http";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrap } from "./main.js";

describe("ApplicationModule", () => {
  let server: Server;

  beforeAll(async () => {
    server = await bootstrap();
  });

  afterAll(async () => {
    server.close();
  });

  describe("Rate Limiting", () => {
    it("should return 429 after exceeding rate limit (100 requests per minute)", async () => {
      const client = supertest(server);
      const maximumNumberOfRequestsPerMinute = 100;

      const responses = await Promise.all(
        Array.from({
          length: maximumNumberOfRequestsPerMinute + 1,
        }).map(() => client.get("/health-check"))
      );

      const isLastResponse429 = responses[responses.length - 1].status === 429;
      expect(isLastResponse429).toBe(true);
    });
  });
});
