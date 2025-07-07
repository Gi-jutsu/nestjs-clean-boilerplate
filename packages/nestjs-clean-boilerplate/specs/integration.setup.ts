import { bootstrapPostgresSqlContainer } from "./bootstrap-postgres-sql-database.util.js";

let postgreSqlContainer: Awaited<
  ReturnType<typeof bootstrapPostgresSqlContainer>
>;

export async function setup() {
  try {
    postgreSqlContainer = await bootstrapPostgresSqlContainer();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

export async function teardown() {
  await postgreSqlContainer.stop();
}
