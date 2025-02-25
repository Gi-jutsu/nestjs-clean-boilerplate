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

  describe("POST /auth/sign-in", () => {
    it("should return 204 and set the access token in a secure, HTTP-only, SameSite=Strict cookie when the credentials are valid", async () => {
      const response = await supertest(server).post("/auth/sign-in").send({
        email: "dylan@call-me-dev.com",
        password: "password",
      });

      expect(response.status).toEqual(204);
      expect(response.headers["set-cookie"][0]).toMatch(
        new RegExp(
          "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.[A-Za-z0-9-_]+.[A-Za-z0-9-_]+; Path=/; HttpOnly; Secure; SameSite=Strict"
        )
      );
    });

    it("should return 404 when the account does not exist", async () => {
      const response = await supertest(server).post("/auth/sign-in").send({
        email: "unknown@call-me-dev.com",
        password: "password",
      });

      expect(response.status).toEqual(404);
      expect(response.body).toEqual({
        code: "resource-not-found",
        detail: "The Account you are trying to access does not exist.",
        pointer: "/data/attributes/email",
        resource: "Account",
        searchedByFieldName: "email",
        searchedByValue: "unknown@call-me-dev.com",
        status: 404,
        timestamp: expect.any(String),
        title: "Resource Not Found",
      });
    });

    it("should return 401 when the password is invalid", async () => {
      const response = await supertest(server).post("/auth/sign-in").send({
        email: "dylan@call-me-dev.com",
        password: "wrong-password",
      });

      expect(response.status).toEqual(401);
      expect(response.body).toEqual({
        code: "wrong-password",
        detail: "The password you entered is incorrect. Please try again.",
        status: 401,
        title: "Unauthorized",
        timestamp: expect.any(String),
      });
    });
  });
});
