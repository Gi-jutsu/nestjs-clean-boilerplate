import { Server } from "http";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrap } from "../../../main.js";

describe("SignInWithCredentialsHttpController", () => {
  let server: Server;

  beforeAll(async () => {
    server = await bootstrap();
  });

  afterAll(async () => {
    server.close();
  });

  describe("POST /auth/sign-up", () => {
    it("should return 201 when the account is created", async () => {
      const response = await supertest(server).post("/auth/sign-up").send({
        email: "new-account@call-me-dev.com",
        password: "password",
      });

      expect(response.status).toEqual(201);
      expect(response.body).toEqual({
        account: {
          id: expect.any(String),
        },
      });
    });

    it("should return 409 when the email is already taken", async () => {
      const response = await supertest(server).post("/auth/sign-up").send({
        email: "dylan@call-me-dev.com",
        password: "password",
      });

      expect(response.status).toEqual(409);
      expect(response.body).toEqual({
        code: "resource-already-exists",
        detail: "The Account you are trying to create already exists.",
        pointer: "/data/attributes/email",
        resource: "Account",
        conflictingFieldName: "email",
        conflictingFieldValue: "dylan@call-me-dev.com",
        status: 409,
        timestamp: expect.any(String),
        title: "Resource Already Exists",
      });
    });
  });
});
