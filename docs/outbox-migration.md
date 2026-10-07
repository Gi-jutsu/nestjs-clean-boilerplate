# Preparing the official NestJS outbox schema

`@nestjs/outbox` owns the tables in `nest_outbox` and provides their versioned SQL. Your application owns its Drizzle migration files, snapshots and journal. The boilerplate does not supply generated migration history or import legacy events automatically.

Application startup uses `migrate: false`: the deployment role applies DDL before each release, and the runtime role checks that the schema is ready. Tests explicitly prepare the package schema in their disposable database; that preparation is not part of application startup.

## First setup in a consuming application

For a fresh application, generate its tables and then create an empty custom migration for the package schema:

```shell
pnpm db:generate --name=initial
pnpm db:generate --custom --name=nest_outbox_v1
pnpm exec nest-outbox sql --from 0 --to 1 --statement-breakpoints
```

Copy the last command's output into **the exact new SQL file path printed by the custom-generation command**. Keep the `--> statement-breakpoint` separators. Review and commit the SQL, snapshots and journal in your application's repository before applying them:

```shell
pnpm db:migrate
```

The outbox CLI does not load `.env`. To check the package schema separately, run
`pnpm exec nest-outbox status --url "<connection-string>"`, or export
`DATABASE_URL` in your shell before running `pnpm exec nest-outbox status`.

The pinned `@nestjs/outbox@0.1.0` requires package schema version `1`; the schema version is separate from the npm package version. The SQL includes the bookkeeping in `nest_outbox.migrations` that the store checks at startup. Do not declare the package's tables again in your Drizzle schema.

For an existing application, preserve its migration files and metadata. Generate changes against that application's history rather than replacing it with a fresh initial migration. If the package schema was previously created outside Drizzle, establish a reviewed baseline before putting its SQL into Drizzle history: applying initial SQL again would try to recreate existing tables.

## Package upgrades

Check `PostgresOutboxStore.schemaVersion` in the newly installed package against the last package schema version represented in your committed application migrations. If it has increased, create another custom migration with `pnpm db:generate --custom --name=nest_outbox_upgrade`. Run `pnpm exec nest-outbox sql` with `--from` set to that recorded version, `--to` set to the new required version, and `--statement-breakpoints`. Fill the exact new path printed by Drizzle, review it and commit it before deploying.

Do not regenerate or overwrite an earlier migration, default every upgrade to `--from 0`, or compute package SQL while an existing migration runs. Generate only when the schema version changes, then keep the generated SQL unchanged. Continue applying the committed migrations with `pnpm db:migrate` before starting the release. Application startup checks the required package schema version.

## Optional recovery of legacy events

Existing installations choose whether and how to recover events from `public.outbox_messages`. Stop all instances of the legacy application before importing anything, back up the database, and inspect pending rows and downstream effects. Its `occurred_at` column has no timezone: verify the legacy writers' database session timezone and timestamp conventions. The example below assumes UTC wall times; adapt it in a reviewed application migration if that assumption is wrong.

After preparing `nest_outbox`, an application can use `pnpm db:generate --custom --name=recover_pending_outbox` and put this SQL in the exact new file Drizzle prints:

```sql
-- Optional application migration: review timestamp conventions and consumers first.
INSERT INTO nest_outbox.messages
  (id, topic, payload, headers, created_at, available_at)
SELECT id::text, event_type, payload, '{}'::jsonb,
  (extract(epoch FROM occurred_at AT TIME ZONE 'UTC') * 1000)::bigint,
  (extract(epoch FROM occurred_at AT TIME ZONE 'UTC') * 1000)::bigint
FROM public.outbox_messages
WHERE processed_at IS NULL
ORDER BY occurred_at, id
ON CONFLICT (id) DO NOTHING;
```

This preserves pending event IDs, topics and payloads and leaves legacy rows intact. The conflict guard protects repeated imports of IDs still present in the destination; it does not make rerunning this migration after delivery safe, because delivered messages leave the outbox. Run the reviewed migration once before restarting the relay and keep stable consumer inbox identities.

Never automatically replay rows with `processed_at IS NOT NULL`. The previous relay wrote that timestamp before delivery, so it does not prove delivery succeeded. Reconcile those rows against downstream effects and recover only events whose consumers can handle duplicates. The legacy table remains declared in Drizzle so schema generation does not silently drop this history; archive or remove it only through a later reviewed application migration.

Before restarting, update event listeners to `@OnOutboxMessage(topic, { consumer: 'stable-consumer-name' })`. A topic without a consumer is retried and eventually dead-lettered. The boilerplate has no production consumers; applications add their own. Monitor `OutboxRelay.stats()` and inspect failed messages through `OutboxDeadLetters`.

New aggregate writes call `publisher.publish(aggregate, transaction)` inside the transaction that saves the aggregate. The adapter preserves domain event IDs and uses the aggregate ID as the ordering key. The relay polls committed messages; an application can inject the official `Outbox` and call `notify()` after commit if it needs lower latency.

For consumer database effects, call `context.processInTransaction(transaction, work)` in the same transaction as those effects. For external effects, use the remote service's idempotency key or another durable duplicate guard.

See the [official outbox documentation](https://docs.nestjs.com/reliability/outbox) and [Drizzle custom-migration documentation](https://orm.drizzle.team/docs/kit-custom-migrations) for the supported generation workflow.
