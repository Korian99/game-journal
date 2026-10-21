import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
const image = "public.ecr.aws/supabase/postgres:17.11.0.004";
export async function disposableDatabase(run) {
  const identity = "gj-qa-" + randomUUID().slice(0, 12),
    container = identity + "-db",
    network = identity + "-net",
    label = "game-journal.qa=" + identity;
  const docker = (...args) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });
  let networkCreated = false,
    containerCreated = false;
  try {
    docker("network", "create", "--internal", "--label", label, network);
    networkCreated = true;
    docker(
      "run",
      "-d",
      "--name",
      container,
      "--network",
      network,
      "--label",
      label,
      "-e",
      "POSTGRES_PASSWORD=" + randomUUID(),
      image,
    );
    containerCreated = true;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        docker(
          "exec",
          container,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "supabase_admin",
          "-p",
          "5432",
        );
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!ready) throw Error("Disposable database did not start.");
    const sql = (input) =>
      execFileSync(
        "docker",
        [
          "exec",
          "-i",
          container,
          "psql",
          "-X",
          "-U",
          "supabase_admin",
          "-p",
          "5432",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-qAt",
        ],
        {
          input,
          encoding: "utf8",
          timeout: 60000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    sql(
      "create schema if not exists auth;create table if not exists auth.users(id uuid primary key,email text);create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;",
    );
    for (const name of fs
      .readdirSync("supabase/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      sql(
        "begin;\n" +
          fs.readFileSync("supabase/migrations/" + name, "utf8") +
          "\ncommit;",
      );
      sql(
        "do $$begin if to_regclass('cron.job') is not null then perform cron.unschedule(jobid) from cron.job;end if;end $$;",
      ); // Never schedule outbound HTTP, even on this isolated network.
    }
    return await run(sql);
  } finally {
    if (containerCreated) {
      const data = JSON.parse(docker("inspect", container));
      if (data[0]?.Config?.Labels?.["game-journal.qa"] !== identity)
        throw Error("Refusing to remove a container not owned by this test.");
      docker("rm", "-f", container);
    }
    if (networkCreated) {
      const data = JSON.parse(docker("network", "inspect", network));
      if (data[0]?.Labels?.["game-journal.qa"] !== identity)
        throw Error("Refusing to remove a network not owned by this test.");
      docker("network", "rm", network);
    }
  }
}
