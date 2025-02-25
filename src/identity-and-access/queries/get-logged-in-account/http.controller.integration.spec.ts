import { Server } from "http";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrap } from "../../../main.js";

describe("GetLoggedInAccountHttpController", () => {
  let server: Server;

  beforeAll(async () => {
    server = await bootstrap();
  });

  afterAll(async () => {
    server.close();
  });

  describe("GET /auth/me", () => {
    it("should return 200 with the logged in account details", async () => {
      const signInResponse = await supertest(server)
        .post("/auth/sign-in")
        .send({
          email: "dylan@call-me-dev.com",
          password: "password",
        });

      const response = await supertest(server)
        .get("/auth/me")
        .set("Cookie", signInResponse.headers["set-cookie"]);

      expect(response.status).toEqual(200);
      expect(response.body).toEqual({
        id: "52afc7a5-f0e7-4477-b5c7-249ef34099a1",
        email: "dylan@call-me-dev.com",
      });
    });
  });
});
