import { Server } from "http";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrap } from "../../../main.js";

describe("ForgotPasswordHttpController", () => {
  let server: Server;

  beforeAll(async () => {
    server = await bootstrap();
  });

  afterAll(async () => {
    server.close();
  });

  describe("POST /auth/forgot-password", () => {
    it("should return 204 when the password reset process has been initiated", async () => {
      const response = await supertest(server)
        .post("/auth/forgot-password")
        .send({ email: "dylan@call-me-dev.com" });

      expect(response.status).toEqual(204);
    });

    it("should return 404 when attempting to reset password for an unregistered email address", async () => {
      const response = await supertest(server)
        .post("/auth/forgot-password")
        .send({ email: "non-registered@call-me-dev.com" });

      expect(response.status).toEqual(404);
      expect(response.body).toEqual({
        code: "resource-not-found",
        detail: "The Account you are trying to access does not exist.",
        pointer: "/data/attributes/email",
        resource: "Account",
        searchedByFieldName: "email",
        searchedByValue: "non-registered@call-me-dev.com",
        status: 404,
        timestamp: expect.any(String),
        title: "Resource Not Found",
      });
    });
  });
});
