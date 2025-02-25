import { Server } from "http";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrap } from "../../../main.js";

describe("HealthCheckHttpController", () => {
  let server: Server;

  beforeAll(async () => {
    server = await bootstrap();
  });

  afterAll(() => {
    server.close();
  });

  it("should return 200 when the api is healthy", async () => {
    const response = await supertest(server).get("/health-check");

    expect(response.status).toEqual(200);
  });
});
