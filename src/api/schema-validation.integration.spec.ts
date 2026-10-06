import { Body, Controller, Post, type INestApplication } from "@nestjs/common";
import supertest, { type Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestingApplication } from "../../specs/testing-application.js";

const REQUEST_SCHEMA = z.strictObject({
  name: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
});

@Controller("schema-validation")
class SchemaValidationController {
  @Post()
  handle(
    @Body({ schema: REQUEST_SCHEMA }) body: z.infer<typeof REQUEST_SCHEMA>,
  ) {
    return body;
  }
}

describe("StandardSchemaValidationPipe HTTP configuration", () => {
  let application: INestApplication;

  it("validates and transforms a request using its Zod schema", async () => {
    const system = createSystemUnderTest(application);
    system.givenAValidRequest();

    await system.whenTheRequestIsSubmitted();

    system.thenTheTransformedInputIsReturned();
  });

  it("refuses input that violates the schema", async () => {
    const system = createSystemUnderTest(application);
    system.givenAnInvalidQuantity();

    await system.whenTheRequestIsSubmitted();

    system.thenTheRequestIsRejected();
  });

  it("refuses undeclared input fields", async () => {
    const system = createSystemUnderTest(application);
    system.givenAnUndeclaredField();

    await system.whenTheRequestIsSubmitted();

    system.thenTheRequestIsRejected();
  });

  it("refuses a missing request body", async () => {
    const system = createSystemUnderTest(application);

    await system.whenTheRequestIsSubmitted();

    system.thenTheRequestIsRejected();
  });

  beforeAll(async () => {
    application = await createTestingApplication(
      { controllers: [SchemaValidationController] },
      { bodyParser: true },
    );
  });

  afterAll(async () => {
    await application.close();
  });
});

function createSystemUnderTest(application: INestApplication) {
  let input: Record<string, unknown>;
  let response: Response;

  return {
    givenAValidRequest() {
      input = { name: "  Sample  ", quantity: "2" };
    },
    givenAnInvalidQuantity() {
      input = { name: "Sample", quantity: -1 };
    },
    givenAnUndeclaredField() {
      input = { name: "Sample", quantity: 2, role: "admin" };
    },
    async whenTheRequestIsSubmitted() {
      response = await supertest(application.getHttpServer())
        .post("/schema-validation")
        .send(input);
    },
    thenTheTransformedInputIsReturned() {
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ name: "Sample", quantity: 2 });
    },
    thenTheRequestIsRejected() {
      expect(response.status).toBe(400);
    },
  };
}
