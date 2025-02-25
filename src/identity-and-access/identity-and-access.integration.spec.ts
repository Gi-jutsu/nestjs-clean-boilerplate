import { Server } from "http";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrap } from "../main.js";

describe("IdentityAndAccessModule", () => {
  let server: Server;

  beforeAll(async () => {
    server = await bootstrap();
  });

  afterAll(async () => {
    server.close();
  });

  describe("Authentication", () => {
    it("should return 403 when requesting a protected resource without being authenticated", async () => {
      const client = supertest(server);
      const response = await client.get("/auth/me");

      expect(response.status).toBe(403);
    });
  });
});
