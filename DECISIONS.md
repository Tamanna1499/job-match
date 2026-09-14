# Decisions

One entry per non-obvious choice: what was decided, why, and what it costs. Decisions that
turned out to be wrong stay in, with how they were found — a log that only records the
choices that worked is a sales document, not a record.

---

## Scope and stack

### D1 · TypeScript on Node, with Fastify and Zod
**TypeScript** runs in `strict` mode with `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`. The scorer's correctness is the graded deliverable, and the
compiler is the cheapest reviewer available: `noUncheckedIndexedAccess` turns every array
lookup in the ranking code into a value that must be handled, and
`exactOptionalPropertyTypes` stops an absent field and an explicit `undefined` being
quietly treated as the same thing.

**Fastify** serves the three endpoints. It validates against a schema per route rather than
leaving it to handler code, which is what makes "reject unknown fields" a property of the
route definition instead of a check someone has to remember to write.

**Zod** validates at the HTTP boundary and produces the types used downstream, so the parsed
request and the domain entity cannot drift apart — one definition, checked at runtime and
at compile time.

**What was considered instead.**

- **Plain JavaScript.** Rejected. This domain is almost entirely numbers that look alike —
  points, years, and lakhs are all just numbers — and the type system is what stops a salary
  being passed where an experience value belongs. It also makes D16 enforceable: with
  `NewCandidate = Omit<Candidate, 'id'>`, a client-supplied id is a compile error rather
  than a rule in a document.
- **Express.** The obvious default, and it would work. Fastify was chosen because request
  validation is part of the route definition rather than middleware bolted on, which is what
  makes rejecting unknown fields structural instead of remembered.
- **NestJS.** Rejected as too much structure for three endpoints: modules, decorators and
  dependency injection are scaffolding this project would carry without using.
- **Joi, ajv or `class-validator`.** Rejected in favour of Zod because Zod infers the
  TypeScript type from the schema. The others keep the validator and the type as two
  declarations that have to be kept in agreement by hand.
- **SQLite or MongoDB.** Rejected on the strength of D13. SQLite has no array type, and a
  document store would put `mustHave` back inside a JSON blob — the exact thing the schema
  is shaped to avoid.
- **A different runtime — Python, Go, Java.** No requirement in the brief pointed to any of
  them, and each would have served. Node was chosen for fluency, which is a real reason but
  not a technical one, and it is recorded here as such.

### D2 · The Docker bonus is declined
`Dockerfile` + `docker-compose.yml` is a listed bonus, and the README requirement hedges it
— *"and via Docker, if attempted"*. Taking it would mean a machine-wide install this
project's containment rule exists to prevent, plus configuration that has to work both
inside and outside a container: two paths to keep working, for a bonus.

The graded core is the scoring model and its justification. This is recorded in the README
as a scope decision rather than left as a silent omission.

### D3 · Embedded PostgreSQL on port 5434
Postgres is spawned from `node_modules` rather than installed on the host. Real SQL, real
constraints, real migrations and real transactions, while setup stays
`npm install && npm start` with nothing left on the machine afterwards.

Port 5434 rather than the default 5432 so the project cannot collide with a Postgres
already running — the containment rule applied to a port number.

**Cost.** `embedded-postgres` has no stable release. Two of its failure modes are handled
explicitly in D21 and D22.

---

## The scoring model

The model itself — every weight, band and threshold — is set out in the README. These are
the decisions taken while settling it, and the reasoning behind them.

### D4 · Weights: skills 50, location 25, salary 15, experience 10
Skills carry half the total because skills are what the job is. Location is next at 25
because it is the constraint most likely to make an otherwise perfect match impossible to
accept. Salary and experience are smaller because both are negotiable in ways the other two
are not: a salary range is an opening position, and a year of experience is not a wall.

### D5 · Must-have skills exclude; everything else only penalises
The asymmetry is deliberate and it is the brief's own instruction. A missing must-have skill
is a fact about whether the candidate can do the job; being a year light on experience or in
the wrong city is a matter of degree. A hard filter that applied to all four dimensions
would return an empty list for almost everyone.

This is why the gate is a separate function from the scorer — see D14.

### D6 · A job that cannot reach the expected salary scores 3, not 5
The brief asks for "near zero" on this dimension. Out of 15, 3 reads as near zero and 5 does
not. The score is also flat rather than graded: two jobs that both fail to reach the
candidate's expectation are both unacceptable, so ranking between them adds noise rather
than information.

### D7 · Salary is measured as the gap from the range floor
Not as the expectation's position within the range. The two agree on most inputs and
disagree on wide ranges: for an expectation of ₹12 LPA, a ₹5–20 LPA posting scores well on
a position-in-range formula — the expectation sits comfortably inside — but the floor is
₹5 LPA, and a range that wide is a signal the employer has not decided what the role pays.
Gap-from-floor scores it 8, which is the right answer.

### D8 · Salary thresholds are absolute, in lakhs
Calibrated for the ₹5–25 LPA range the worked examples describe. Proportional thresholds of
1/6, 1/4 and 1/3 reproduce every example exactly at E = ₹12 LPA and would also hold at other
scales; they were considered and not adopted, in favour of how directly the absolute rule
states its intent.

**Known limit.** A ₹4 LPA expectation against a ₹2–5 LPA range scores full marks even though
the floor is half the expectation. The assumed salary range is stated in the README.

### D9 · The experience middle band is inclusive — `shortfall <= 1`
The rule was written in whole years. Six months short scores 8; eighteen months short scores
5. This defines the fractional case rather than rejecting it, because eighteen months of
experience is a real thing a candidate would enter into a form.

### D10 · Skills are matched exactly, after normalisation. No synonym inference
Normalisation lowercases and strips everything that is not alphanumeric. "React.js" matches
"reactjs"; "Node JS" matches "nodejs".

Synonyms are not inferred. Deciding that "JS" means "JavaScript", or that React implies
JavaScript, is a judgement the scorer would be making on the candidate's behalf, invisibly,
and a transparent rule-based scorer is exactly what the brief asks for.

**Known limit, recorded by an explicit test.** C, C++ and C# all normalise to `c`. Fixing it
means either a synonym table — rejected above — or a normaliser that knows about specific
languages, which is the same judgement wearing a different hat. The test exists so the
limitation is a documented property rather than a latent surprise.

### D11 · Ties break by dimension, in weight order
Total, then skills, then location, then salary, then experience, then job id. Two jobs on
the same total are separated by the dimension that matters most. Job id settles anything
still tied, because a ranking that reorders between identical requests is a bug that
surfaces much later as flakiness.

### D12 · Weights and thresholds live in `config/`, never as literals in code
The whole model can be read in one place and tuned without touching logic. It also makes the
configurable-weights bonus a small change rather than a refactor, if it is ever earned.

---

## Storage

### D13 · Required skills are their own table; candidate skills are an array column
A candidate's `skills` is a flat list with no per-item attributes, so `text[]` says it
exactly. A job's `requiredSkills` carries `mustHave` per skill, and that flag is the hard
filter — the one rule in the brief that removes a job from the results entirely.

A rule that load-bearing is worth the database stating: `must_have` is a typed `NOT NULL`
column in `job_required_skills`, not a key inside a JSON document.

**Alternative considered.** `jsonb` for both. Simpler — no join, one insert per entity — and
adequate, because the API only ever reads whole entities and all scoring happens in memory.
It was rejected on the strength of the typed flag, not on performance: the join buys a query
nobody has asked for yet.

### D14 · The eligibility gate is a separate function from the scorer
`checkEligibility` decides whether a job appears at all; the four dimension functions decide
how well it fits. `scoreJob` runs the gate first and returns an exclusion — not a low score
— when it fails, so nothing downstream ever sees a job the candidate could not take.

Splitting them means the must-have rule exists in exactly one place. See D27 for the
proposal to duplicate it, and why it was rejected.

### D15 · Years and salaries are `double precision`, not `numeric`
The domain type is a JavaScript `number` and a double round-trips one exactly. `numeric`
arrives back from `pg` as a string and would need parsing at every read — a conversion step
at every boundary, which is where unit bugs live. Salaries are in lakhs, a range of roughly
1 to 100, so the precision is not in question.

The unit is in the field name — `expectedSalaryLpa`, `salaryRangeLpa` — because the scoring
specification is written in lakhs and storing anything else would mean converting at every
comparison.

### D16 · The server mints ids; clients do not supply them
`POST` returns the stored record and its id. `NewCandidate` and `NewJob` are
`Omit<…, 'id'>`, so it is the type system enforcing this rather than a convention.

A useful consequence: there is no duplicate-id conflict to design for, and therefore no
`409` in the API surface.

### D17 · Job creation is transactional
A job and its required skills are one fact. A job that committed without its skill rows
would not be a partial record — it would be a job *every candidate is eligible for*,
silently, created by a request that failed.

An integration test asserts the rollback. The test was confirmed to fail when the
transaction is removed, so it is known to be testing something.

### D18 · Jobs and their skills are read as two queries, not one join
A join returns the job's columns repeated once per skill, and the de-duplication needed to
undo that is more code than a second query — which the database answers straight from the
primary key.

### D19 · `findAll()` loads every job
Ranking is a total order over all jobs, and the must-have filter is a property of the
*candidate*, not of any single job, so there is no `WHERE` clause that narrows the set
first. Correct at this scale.

**Known limit.** This does not hold at large scale; it would need a pre-filter on must-have
skills in SQL, or a different approach entirely. Stated in the README rather than hidden
here.

### D20 · Invariants are CHECK constraints in the database
An inverted salary range would make the salary rule incoherent — the gap is measured from
the floor and the reachability test reads the ceiling. Non-negative experience and positive
salaries are checked too.

Zod validates the same things at the HTTP boundary. That is not duplication for its own
sake: Zod guards one entry point, the constraints guard the table against every writer,
including the seed script and anything typed into `npm run db:console`.

The constraints were verified by inserting bad rows and reading the SQLSTATE — `23514`
check, `23503` foreign key, `23505` unique — rather than by observing that they exist.
Drizzle reports every failure as "Failed query", which a syntax error also produces.

### D21 · `initdb` is skipped when a cluster already exists
`initdb` refuses to run over an existing data directory. Calling it unconditionally
therefore produces a project that starts perfectly the first time and fails on every
restart — and the failure is easy to miss during development, where runs tend to follow a
wiped data directory.

`initialise()` is called only when the data directory has no `PG_VERSION` in it. Verified by
running twice against the same `.pgdata`.

### D22 · A failed cluster start reports Postgres's own output
Also carried forward. A start failure surfaced as an empty error, because Postgres reports
what went wrong on its own stderr rather than through the rejected promise. That output is
captured and attached to the thrown error, with the password scrubbed from it before it is
ever shown.

### D23 · `drizzle/` is committed, including `meta/`
Migrations are generated once and then become history: they describe what has already been
applied to real databases, so they cannot be regenerated from current source. `_journal.json`
is read by the migrator before anything else, and `0000_snapshot.json` is what
`drizzle-kit generate` diffs against to produce the *next* migration.

Verified by deleting each in turn against a fresh database: without `meta/`,
`Can't find meta/_journal.json`; without the `.sql`, `No file … found in ./drizzle folder`.

---

## Structure and tooling

### D24 · `scoring/` performs no I/O, and a dependency rule enforces it
No database handle, no HTTP, no clock — a pure function from a candidate and a job to a
score and a breakdown. The brief calls scoring tests "the highest-value place to test", and
purity is what lets the whole of it run in milliseconds with no fixtures.

`dependency-cruiser` fails the build if `scoring/` imports `api/`, `repository/` or `db/`.
Stated as a rule the build enforces, the boundary holds; stated as an intention in a README,
it erodes the first time something is convenient.

### D25 · `db/` is given a logger; it does not reach for `console`
`connect()` takes a `Logger`. Storage should not decide where a message goes — the server
owns that — and `db/` importing Fastify's logger would invert the layering.

The pool's `error` event logs `error.message` only. Logging the error object itself prints
the whole connection configuration with it, password included — a `pg` error carries the
config that produced it. The listener also has to exist regardless: an unhandled pool
`error` takes the process down.

### D26 · Unit tests and integration tests are separate
`npm test` is unit-only — 61 tests, about 150ms — so the graded scoring tests stay fast
enough to run on every save. `npm run test:integration` starts a real cluster.
`npm run verify` runs both.

Integration tests run against real PostgreSQL rather than a fake repository. A fake proves
the code compiles against its own assumptions; the things that actually break in storage —
a transaction that does not roll back, an array column returning the wrong shape, a
constraint that was never applied — only appear against the real thing.

---

## Reversed, rejected, or accepted with a known cost

### D27 · Rejected: re-checking must-have skills inside `scoreSkills`
**Proposed by the AI assistant. Rejected by the author. No code changed.**

`scoreSkills` awards the full 40 must-have points without checking must-haves; it relies on
the gate having run. Called directly with a candidate missing every must-have skill, it
returns 50/50 with the reason `"all must-have skills matched"`. The assistant demonstrated
this with a probe and proposed computing must-have coverage inside the function.

The objection: the gate always runs, `scoreJob` is the only production caller, and the
proposed fix recomputes exactly what `checkEligibility` already computed — the same filter,
the same normalisation, the same lookup. One rule in two places.

The objection is correct and the proposal was withdrawn. The failing case had been
manufactured by calling the function outside its contract in a script written for that
purpose; a function being wrong when used wrongly is not the same as a defect. The design
stands: one rule, one place, with the ordering guaranteed structurally by `scoreJob`'s
early return.

### D28 · Accepted: four moderate `npm audit` findings, all dev-only
All four trace to one root — an advisory against **esbuild's development server** — reaching
the project through `drizzle-kit`'s deprecated `@esbuild-kit/*` dependencies.

`drizzle-kit` is a devDependency used only to generate migration SQL, and esbuild's dev
server is never run. Accepted rather than force-upgrading a migration tool to satisfy an
advisory that does not describe a path this project has.

---

### D29 · Integration tests own a separate database and cluster
The original integration suite inherited the development database settings and deleted
every candidate and job after each test. Integration tests now reserve `.pgdata-test`,
port **5435**, database `jobmatch_test`, and a separate local role. Vitest overrides all
five database environment settings before the application configuration is imported.
These names are reserved for tests and must not be used for development data.

A guard runs before cluster startup and refuses any other directory, port or database,
including a symlink at the test directory. Cleanup is skipped when setup never obtained
a database connection. The directory is already covered by `.pgdata-*/` in `.gitignore`;
it persists between runs to exercise restart behavior. Separate concurrent integration
runs still share this test port and directory and should be run sequentially.

The guard was deliberately disabled: four regression tests failed. Pointing the suite
at the development defaults then failed before startup. Both mutations were restored.
The integration suite also queries PostgreSQL's actual database, port and data directory.

---

### D30 · Startup owns the HTTP and database lifecycle
The API listens on `127.0.0.1:3107` by default, only after the embedded cluster starts,
the application database exists, and migrations finish. Boot validates ports, SQL names,
the password's presence, and that the database directory resolves inside the project.
Connections and statements have five-second timeouts. If migrations or HTTP binding fail,
startup closes the pool and cluster. The health route queries PostgreSQL through a
repository contract, returning 503 if it cannot answer.

`embedded-postgres` also installs an `async-exit-hook` SIGTERM handler that forces exit code
143. A compiled-server smoke test found that this raced the API's own shutdown. The CLI
entry point removes that library handler for SIGINT and SIGTERM, then drains Fastify,
closes the pool, and stops PostgreSQL itself. The dependency was made direct because the
CLI now relies on its public `unhookEvent` API. The same smoke test then served `/health`
and exited with code 0 on SIGTERM.

An `.npmrc` sends npm's cache and logs to the project-local, ignored `.npm-cache`.
PostgreSQL's default temporary files and Unix sockets remain outside the project; full
filesystem containment is still unfinished.

---

## How AI tools were used

The README requires specifics on this, including where suggestions were overridden. This
section is the source for it, written as the work happens rather than reconstructed.

- **Claude Code (Opus 5)** was used throughout: scaffolding, the scoring implementation, the
  storage layer, tests, and these documents.
- **Codex** implemented the integration database isolation in D29, added regression tests,
  and checked that the guard rejects development settings before startup.
- **Codex** implemented the startup lifecycle in D30. Its initial signal handler passed
  endpoint tests but failed the compiled-server smoke test with exit code 143; inspecting
  the dependency's exit hook led to the revised shutdown ownership above.
- **The scoring model is the author's own**, specified in writing before any
  implementation. The assistant had drafted an alternative; it was compared against the
  author's and the author's was kept — D7 is the clearest case, where the assistant's
  position-in-range formula scored a ₹5–20 LPA range backwards.
- **D27 is an overridden suggestion** — a change proposed, challenged, and withdrawn, with
  no code written.
- **Verification was not delegated.** Several claims the assistant made during the work were
  wrong until measured: exit codes read through a shell pipe reported success while the
  underlying command failed; the constraint tests looked correct until the SQLSTATEs were
  read; the transaction rollback test was only trusted after the transaction was removed and
  the test was seen to fail.
