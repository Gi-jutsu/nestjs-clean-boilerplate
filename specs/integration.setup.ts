import { bootstrapPostgresSqlContainer } from "./bootstrap-postgres-sql-database.util.js";

let postgreSqlContainer: Awaited<
  ReturnType<typeof bootstrapPostgresSqlContainer>
>;

export async function setup() {
  postgreSqlContainer = await bootstrapPostgresSqlContainer();
}

export async function teardown() {
  await postgreSqlContainer.stop();
}
