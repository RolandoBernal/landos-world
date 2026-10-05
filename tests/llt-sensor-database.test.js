// Explicitly opt-in LOCAL ONLY; never loads production configuration or credentials.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync, execFile } from "node:child_process";
const docker = "/Applications/Docker.app/Contents/Resources/bin/docker";
const container = "supabase_db_llt-14-5-curated";
const enabled = process.env.LLT_LOCAL_SENSOR_DB_TEST === "1";
const args = [
  "exec",
  "-i",
  container,
  "psql",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-X",
  "-qAt",
  "-v",
  "ON_ERROR_STOP=1",
];
function sql(query) {
  const r = spawnSync(docker, args, { input: query, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function user() {
  const id = randomUUID();
  sql(`insert into auth.users(id,email) values('${id}','${id}@sensor.test');`);
  return id;
}
const at = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
function command(
  uid,
  revision = 0,
  current = null,
  action = "start",
  start = at(1),
  id = randomUUID(),
) {
  return {
    uid,
    op: randomUUID(),
    action,
    revision,
    current,
    id: action === "start" ? id : null,
    start: action === "undo_current" ? null : start,
    confirm: action === "start" && !!current,
  };
}
const literal = (v) =>
  v === null
    ? "null"
    : typeof v === "number" || typeof v === "boolean"
      ? String(v)
      : `'${String(v).replaceAll("'", "''")}'`;
function callSQL(c) {
  return `select public.llt_mutate_sensor_cycle(${[c.op, c.action, c.revision, c.current, c.id, c.start, c.confirm, "Emily", "{}"].map(literal).join(",")});`;
}
function roleSQL(uid, query, delay = false) {
  return `begin;set local role authenticated;set local request.jwt.claim.sub='${uid}';${query}${delay ? "select pg_sleep(0.3);" : ""}commit;`;
}
function call(c) {
  return JSON.parse(sql(roleSQL(c.uid, callSQL(c))));
}
function snapshot(uid) {
  return JSON.parse(
    sql(roleSQL(uid, "select public.llt_get_sensor_snapshot();")),
  ).snapshot;
}
function first(hours = 300) {
  const uid = user(),
    c = command(uid, 0, null, "start", at(hours)),
    r = call(c);
  assert.equal(r.status, "accepted");
  return { uid, c, r };
}
function check(name, fn) {
  test(name, { skip: !enabled }, fn);
}
check("first start, pointer, revision and authoritative snapshot", () => {
  const { uid, c, r } = first();
  assert.equal(r.snapshot.currentCycleId, c.id);
  assert.equal(snapshot(uid).revision, 1);
});
for (const [name, hours] of [
  ["normal", 240],
  ["early", 30],
  ["grace", 245],
  ["expired", 260],
])
  check(
    `${name} replacement retains history and closes at entered next start`,
    () => {
      const { uid, c } = first(hours);
      const next = command(uid, 1, c.id);
      const r = call(next);
      assert.equal(r.status, "accepted");
      assert.equal(r.snapshot.cycles.length, 2);
      assert.equal(
        Date.parse(r.snapshot.cycles.find((x) => x.id === c.id).ended_at),
        Date.parse(next.start),
      );
      assert.equal(r.snapshot.revision, 2);
    },
  );
check("edit current preserves identity and changes authoritative start", () => {
  const { uid, c } = first();
  const edit = command(uid, 1, c.id, "edit_start", at(290));
  const r = call(edit);
  assert.equal(r.status, "accepted");
  assert.equal(r.snapshot.currentCycleId, c.id);
  assert.equal(
    Date.parse(r.snapshot.cycles[0].started_at),
    Date.parse(edit.start),
  );
});
check("edit current also corrects linked predecessor boundary", () => {
  const { uid, c } = first();
  const next = command(uid, 1, c.id);
  call(next);
  const edit = command(uid, 2, next.id, "edit_start", at(2));
  const r = call(edit);
  assert.equal(r.status, "accepted");
  assert.equal(
    Date.parse(r.snapshot.cycles.find((x) => x.id === c.id).ended_at),
    Date.parse(edit.start),
  );
});
check("undo first retains cancelled history and clears pointer", () => {
  const { uid, c } = first();
  const r = call(command(uid, 1, c.id, "undo_current"));
  assert.equal(r.status, "accepted");
  assert.equal(r.snapshot.currentCycleId, null);
  assert.equal(r.snapshot.cycles[0].state, "cancelled");
});
check(
  "undo replacement reopens predecessor without erasing cancelled cycle",
  () => {
    const { uid, c } = first();
    const n = command(uid, 1, c.id);
    call(n);
    const r = call(command(uid, 2, n.id, "undo_current"));
    assert.equal(r.snapshot.currentCycleId, c.id);
    assert.equal(r.snapshot.cycles.find((x) => x.id === c.id).ended_at, null);
    assert.equal(
      r.snapshot.cycles.find((x) => x.id === n.id).state,
      "cancelled",
    );
  },
);
for (const [name, mutate, reason] of [
  [
    "future",
    (c) => {
      c.start = new Date(Date.now() + 3600000).toISOString();
    },
    "invalid_start_time",
  ],
  [
    "chronology",
    (c) => {
      c.start = at(400);
    },
    "replacement_not_after_current_start",
  ],
  [
    "duplicate cycle",
    (c) => {
      c.id = c.current;
    },
    "cycle_id_exists",
  ],
  [
    "confirmation",
    (c) => {
      c.confirm = false;
    },
    "replacement_confirmation_required",
  ],
])
  check(`${name} rejects without revision increment`, () => {
    const { uid, c } = first();
    const n = command(uid, 1, c.id);
    mutate(n);
    const r = call(n);
    assert.equal(r.status, "invalid_state");
    assert.equal(r.reason, reason);
    assert.equal(snapshot(uid).revision, 1);
  });
check("malformed action rejects without receipt", () => {
  const uid = user(),
    c = command(uid);
  c.action = "patch";
  assert.equal(call(c).status, "invalid_request");
  assert.equal(snapshot(uid).revision, 0);
});
for (const pointer of [false, true])
  check(
    `stale ${pointer ? "pointer" : "revision"} conflicts and receipt replay remains final`,
    () => {
      const { uid, c } = first();
      const n = command(uid, pointer ? 1 : 0, pointer ? randomUUID() : c.id);
      const r = call(n);
      assert.equal(r.status, "conflict");
      assert.equal(r.reason, "stale_context");
      assert.equal(call(n).replayed, true);
      assert.equal(snapshot(uid).revision, 1);
    },
  );
check(
  "exact retry after later mutation returns original outcome and fresh snapshot",
  () => {
    const { uid, c } = first();
    const n = command(uid, 1, c.id);
    call(n);
    const r = call(c);
    assert.equal(r.replayed, true);
    assert.equal(r.operationRevision, 1);
    assert.equal(r.snapshot.revision, 2);
    assert.equal(r.snapshot.currentCycleId, n.id);
    assert.equal(
      sql(
        `select count(*) from public.llt_sensor_operations where user_id='${uid}';`,
      ),
      "2",
    );
  },
);
check(
  "same ID changed canonical request cannot change receipt or state",
  () => {
    const { uid, c } = first();
    const r = call({ ...c, start: at(299) });
    assert.equal(r.reason, "operation_id_reused");
    assert.equal(snapshot(uid).revision, 1);
    assert.equal(call(c).status, "accepted");
  },
);
check(
  "unique partial index rejects two current cycles even for privileged writes",
  () => {
    const { uid } = first();
    assert.throws(
      () =>
        sql(
          `insert into public.llt_sensor_cycles(user_id,id,started_at,state,created_actor,updated_actor,revision) values('${uid}','${randomUUID()}',now(),'current','Unknown','Unknown',1);`,
        ),
      /unique/,
    );
  },
);
check("finite timestamps and same-context predecessor constraints", () => {
  const { uid } = first();
  for (const timestamp of ["infinity", "-infinity"])
    assert.throws(
      () =>
        sql(
          `insert into public.llt_sensor_cycles(user_id,id,started_at,state,created_actor,updated_actor,revision) values('${uid}','${randomUUID()}','${timestamp}','cancelled','Unknown','Unknown',1);`,
        ),
      /check constraint/,
    );
});
check("two users read own rows only; metadata cannot grant ownership", () => {
  const a = first(),
    b = first();
  assert.equal(
    sql(
      roleSQL(
        a.uid,
        `select count(*) from public.llt_sensor_cycles where user_id='${b.uid}';`,
      ),
    ),
    "0",
  );
  assert.equal(
    sql(
      roleSQL(
        b.uid,
        `select count(*) from public.llt_sensor_cycles where user_id='${a.uid}';`,
      ),
    ),
    "0",
  );
  assert.equal(snapshot(a.uid).currentCycleId, a.c.id);
  assert.equal(snapshot(b.uid).currentCycleId, b.c.id);
});
check(
  "same cycle and operation UUIDs in separate auth contexts remain isolated",
  () => {
    const a = first(),
      b = user();
    const r = call({ ...a.c, uid: b });
    assert.equal(r.status, "accepted");
    assert.equal(snapshot(b).cycles[0].user_id, b);
    assert.equal(snapshot(a.uid).cycles[0].user_id, a.uid);
  },
);
for (const query of [
  "select * from public.llt_sensor_cycles;",
  "select public.llt_get_sensor_snapshot();",
])
  check(
    `anon cannot ${query.includes("*") ? "read tables" : "execute read RPC"}`,
    () =>
      assert.throws(
        () => sql(`begin;set local role anon;${query}commit;`),
        /permission denied/,
      ),
  );
for (const query of [
  "insert into public.llt_sensor_contexts(user_id) values(auth.uid());",
  "update public.llt_sensor_contexts set revision=revision+1;",
  "delete from public.llt_sensor_cycles;",
  "select public.llt_sensor_snapshot_for_user(auth.uid());",
])
  check(
    `browser denied ${query.split(" ")[0]} ${query.includes("helper") ? "helper" : ""}`,
    () => {
      const uid = user();
      assert.throws(() => sql(roleSQL(uid, query)), /permission denied/);
    },
  );
check("forced receipt failure rolls back cycle, pointer and revision", () => {
  const { uid, c } = first();
  const n = command(uid, 1, c.id);
  sql(
    `create function public.llt_test_fail_receipt() returns trigger language plpgsql as $$begin if new.operation_id='${n.op}'::uuid then raise exception 'synthetic receipt failure';end if;return new;end;$$;create trigger llt_test_fail_receipt before insert on public.llt_sensor_operations for each row execute function public.llt_test_fail_receipt();`,
  );
  try {
    assert.throws(() => call(n), /synthetic receipt failure/);
    assert.equal(snapshot(uid).revision, 1);
    assert.equal(snapshot(uid).cycles.length, 1);
  } finally {
    sql(
      "drop trigger llt_test_fail_receipt on public.llt_sensor_operations;drop function public.llt_test_fail_receipt();",
    );
  }
});
function concurrent(c) {
  return new Promise((resolve, reject) => {
    const proc = execFile(docker, args, { encoding: "utf8" }, (e, out, err) =>
      e
        ? reject(new Error(err))
        : resolve(JSON.parse(out.trim().split("\n")[0])),
    );
    proc.stdin.end(roleSQL(c.uid, callSQL(c), true));
  });
}
for (const kind of ["first", "replace", "edit-replace", "undo-edit"])
  check(
    `actual separate-connection ${kind} race serializes one winner`,
    async () => {
      let uid, c, rev;
      if (kind === "first") {
        uid = user();
        rev = 0;
        c = { id: null };
      } else {
        ({ uid, c } = first());
        rev = 1;
      }
      const a = command(
        uid,
        rev,
        c.id,
        kind === "edit-replace"
          ? "edit_start"
          : kind === "undo-edit"
            ? "undo_current"
            : "start",
        at(2),
      );
      const b = command(
        uid,
        rev,
        c.id,
        kind === "undo-edit" ? "edit_start" : "start",
        at(1),
      );
      const outcomes = await Promise.all([concurrent(a), concurrent(b)]);
      assert.deepEqual(outcomes.map((r) => r.status).sort(), [
        "accepted",
        "conflict",
      ]);
      const snap = snapshot(uid);
      assert.equal(snap.revision, rev + 1);
      assert.ok(snap.cycles.filter((x) => x.state === "current").length <= 1);
    },
  );
check(
  "security definer hardening, RLS and realtime publication catalog",
  () => {
    assert.equal(
      sql(
        "select count(*) from pg_class where relname in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations') and relrowsecurity;",
      ),
      "3",
    );
    assert.equal(
      sql(
        "select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='llt_sensor_contexts';",
      ),
      "1",
    );
    assert.equal(
      sql(
        "select count(*) from pg_proc where proname in ('llt_get_sensor_snapshot','llt_mutate_sensor_cycle') and prosecdef and proconfig::text like '%search_path%';",
      ),
      "2",
    );
  },
);
check("cross-context predecessor and self predecessor are rejected", () => {
  const a = first(),
    b = first();
  const common = `'${a.uid}','${randomUUID()}','${at(10)}','closed','${at(1)}','Emily','Emily',2`;
  assert.throws(
    () =>
      sql(
        `insert into public.llt_sensor_cycles(user_id,id,started_at,state,ended_at,created_actor,updated_actor,revision,previous_cycle_id) values(${common},'${b.c.id}');`,
      ),
    /foreign key/,
  );
  assert.throws(
    () =>
      sql(
        `update public.llt_sensor_cycles set previous_cycle_id=id where user_id='${a.uid}';`,
      ),
    /check constraint/,
  );
});
check(
  "structural state and operational end constraints reject invalid combinations",
  () => {
    const { uid, c } = first();
    for (const patch of [
      "state='closed'",
      "ended_at=started_at",
      "state='cancelled'",
      "cancelled_at=now()",
    ]) {
      assert.throws(
        () =>
          sql(
            `update public.llt_sensor_cycles set ${patch} where user_id='${uid}' and id='${c.id}';`,
          ),
        /check constraint/,
      );
    }
  },
);
check(
  "context CAS prevents stale ABA after undo restores an old pointer",
  () => {
    const { uid, c } = first();
    const stale = command(uid, 1, c.id);
    const n = command(uid, 1, c.id);
    call(n);
    call(command(uid, 2, n.id, "undo_current"));
    assert.equal(call(stale).status, "conflict");
    assert.equal(snapshot(uid).revision, 3);
  },
);
check(
  "empty and failed migration-like changes roll back without changing sensor contract",
  () => {
    assert.throws(
      () =>
        sql(
          "begin;create table public.llt_test_rollback(id integer);select 1/0;commit;",
        ),
      /division by zero/,
    );
    assert.equal(
      sql("select to_regclass('public.llt_test_rollback') is null;"),
      "t",
    );
  },
);
