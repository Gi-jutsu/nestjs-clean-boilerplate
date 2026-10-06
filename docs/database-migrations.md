# Application-owned migrations

The boilerplate provides Drizzle schemas, configuration, and generation commands.
It does not distribute generated SQL, snapshots, or a migration journal. Those
files describe an application's deployment history and belong to that application.
The `drizzle/` directory is deliberately not ignored by Git.

## Starting a new application

Configure `DATABASE_URL` in `.env`, then run:

```shell
pnpm db:generate --name=initial
```

Before applying this history, add a custom migration for the official outbox
schema using the [package-schema generation workflow](outbox-migration.md#first-setup-in-a-consuming-application).
Drizzle allocates the new file in your application history; fill it with the
versioned SQL from the installed NestJS package.

Review the generated SQL and commit the entire `drizzle/` directory, including
snapshots and the journal. Apply the reviewed files to an empty database with
`pnpm db:migrate` before starting the application.

## Updating an existing application

Preserve your application's complete migration directory when importing template
updates. This includes migrations originally copied from older boilerplate
versions. The template's removal of those files does not mean they should be
deleted from your application. Restore them from your application branch if an
upstream merge removes them.

Review changes to the TypeScript schemas, then run `pnpm db:generate` against your
existing snapshots. Review and test the resulting incremental SQL against a copy
of the application's existing database before deploying it. Keep previously
applied SQL and existing snapshots unchanged; extend the existing journal and
commit it with each new migration and snapshot. Do not generate a fresh initial
migration for an existing database.

For example, if your latest snapshot does not yet include the nullable
`account.issuer` field, generate an additive migration after that snapshot. Review
that it adds the column without recreating existing tables. Its filename and
position in your history are application-specific.

If an existing database has no migration history, reconcile its current schema
and establish an application baseline before adopting this workflow. Generating
initial SQL does not establish that the SQL is safe to apply to populated tables.

Package-owned schema upgrades also use new custom migrations in your application
history. The [outbox upgrade workflow](outbox-migration.md#package-upgrades) explains
how to select the package schema versions without rewriting applied migrations.

## Deployment and tests

Generate migrations during development, review and commit them, and apply the
committed files in a separate release step. Application startup does not generate
or apply schema changes. Do not automatically regenerate migrations during
installation or deployment.

Template integration tests prepare disposable PostgreSQL databases from the
current schema without reading or changing `drizzle/`. This checks application
compatibility with the schema; each consuming application must also test its own
incremental migration history and data transitions.

See the [NestJS Drizzle documentation](https://docs.nestjs.com/data/drizzle) and
[Drizzle generation documentation](https://orm.drizzle.team/docs/drizzle-kit-generate)
for the standard generation and migration commands.
