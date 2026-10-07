import { ApplicationModule } from "@api/application.module.js";
import { configureHttpApplication } from "@api/configure-http-application.js";
import { createHttpApplicationOptions } from "@api/http-application-options.js";
import type { ModuleMetadata, NestApplicationOptions } from "@nestjs/common";
import { Test } from "@nestjs/testing";

export async function createTestingApplication(
  metadata: ModuleMetadata = { imports: [ApplicationModule] },
  options: Pick<NestApplicationOptions, "bodyParser" | "instrument"> = {},
) {
  const module = await Test.createTestingModule(metadata).compile();
  const application = module.createNestApplication({
    ...createHttpApplicationOptions(),
    ...options,
  });

  application.useLogger(false);
  configureHttpApplication(application);
  try {
    await application.listen(0, "127.0.0.1");
  } catch (error) {
    await application.close();
    throw error;
  }

  return application;
}
