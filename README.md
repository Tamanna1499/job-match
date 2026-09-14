# Job Match API

Job Match is a small rule based recommendation API. It ranks jobs for a candidate using
skills, location, salary, and experience, and returns the score breakdown so every result
can be inspected. It is deliberately a transparent scorer, not a machine learning model.

## Run it

Requirements: Node.js 22 or newer. PostgreSQL is embedded in the project, so no host
database installation is needed.

```bash
npm install
npm run build
npm start
```

For development, `npm run dev` runs the TypeScript entry point directly. The API listens on
`127.0.0.1:3107`; the embedded PostgreSQL cluster uses port `5434` and stores its data in
the ignored `.pgdata/` directory. Stop the API before running `npm run db:seed`, because
both commands own the same embedded cluster.

The local connection settings can be overridden with `APP_PORT`, `PGPORT`, `PGDATA_DIR`,
`PGUSER`, `PGPASSWORD`, and `PGDATABASE`. The runtime rejects invalid ports, SQL names,
empty passwords, and database directories outside the project.

## Try the seeded example

With the API stopped, run:

```bash
npm run db:seed
```

The command creates two candidates and three jobs through the repository layer, then prints
their ranked matches and four part score breakdowns. It adds fresh records on each run and
does not delete existing development data.

## API

### `GET /health`

Checks PostgreSQL and returns `200` when it responds:

```bash
curl -i http://127.0.0.1:3107/health
```

### `POST /candidates`

Creates a candidate. The server generates the id.

```bash
curl -i -X POST http://127.0.0.1:3107/candidates \
  -H 'content-type: application/json' \
  -d '{
    "name": "Asha",
    "skills": ["TypeScript", "Node.js"],
    "yearsOfExperience": 4,
    "location": "Pune",
    "expectedSalaryLpa": 12
  }'
```

### `POST /jobs`

Creates a job and its required skills in one transaction.

```bash
curl -i -X POST http://127.0.0.1:3107/jobs \
  -H 'content-type: application/json' \
  -d '{
    "title": "Backend Engineer",
    "requiredSkills": [
      {"skill": "TypeScript", "mustHave": true},
      {"skill": "Node.js", "mustHave": false}
    ],
    "minYearsExperience": 3,
    "location": "Pune",
    "salaryRangeLpa": {"min": 10, "max": 15},
    "remoteAllowed": false
  }'
```

### `GET /candidates/:id/recommendations?limit=10`

Returns eligible jobs in descending score order. `limit` is optional, defaults to `10`, and
accepts values from `1` through `100`. Replace `CANDIDATE_ID` with the id returned when the
candidate was created:

```bash
curl -s \
  'http://127.0.0.1:3107/candidates/CANDIDATE_ID/recommendations?limit=3' | jq .
```

Each result has a `jobId`, a score from `0` to `100`, and one explanation for each scoring
dimension:

```json
{
  "jobId": "j-12",
  "score": 83,
  "breakdown": [
    { "dimension": "skills", "earned": 46, "max": 50, "reason": "..." },
    { "dimension": "location", "earned": 20, "max": 25, "reason": "..." },
    { "dimension": "salary", "earned": 12, "max": 15, "reason": "..." },
    { "dimension": "experience", "earned": 5, "max": 10, "reason": "..." }
  ]
}
```

An unknown candidate returns `404` with `{ "error": { "code": "NOT_FOUND", ... } }`.
A known candidate with no eligible jobs returns `200` and `[]`. Invalid values and unknown
fields return `400` with `{ "error": { "code": "INVALID_REQUEST", ... } }`.

## Scoring model

The maximum is 100 points. Skills carry half the score because they are the strongest
signal of capability and the only dimension that can disqualify a job. Location carries 25
because a job must be practically reachable. Salary carries 15 as a negotiable constraint,
and experience carries 10 because years served are only a proxy for capability; the skills
signal already carries the stronger evidence.

### Skills — 50 points

Before scoring, a job is removed if the candidate is missing any `mustHave` skill. A filter
cannot be outscored by a high result on the other dimensions. For an eligible job:

```text
40 + 10 × (matched nice-to-have skills / total nice-to-have skills)
```

No nice-to-have skills means the full 50 points. Skills are lowercased and reduced to
alphanumeric characters, so `Node.js`, `node js`, and `NODEJS` match. There is no synonym
inference: `JS` does not match `JavaScript`.

### Location — 25 points

| Condition                                | Points |
| ---------------------------------------- | -----: |
| Exact location match                     |     25 |
| Different location and remote is allowed |     20 |
| Different location and on-site only      |      8 |

Location never excludes a job, and nearby cities are not modelled.

### Salary — 15 points

If the salary maximum is below the candidate's expectation, the score is `3`. Otherwise,
let `gap = expected salary - salary minimum`:

| Condition      | Points |
| -------------- | -----: |
| `gap <= 2`     |     15 |
| `2 < gap <= 3` |     12 |
| `3 < gap <= 4` |     10 |
| `gap > 4`      |      8 |

Values are in LPA. The absolute thresholds are calibrated for the assumed ₹5–25 LPA range.
At very different salary scales they would need recalibration.

### Experience — 10 points

| Condition                                   | Points |
| ------------------------------------------- | -----: |
| At or above the minimum, or minimum is zero |     10 |
| Up to one year below the minimum            |      8 |
| More than one year below the minimum        |      5 |

Experience never excludes a job because it is an imperfect proxy for ability.

### Ranking and tie breaks

Jobs are sorted by total score, then by the individual dimensions in this order: skills,
location, salary, experience. Job id resolves any remaining tie, making repeated requests
deterministic.

## Design

The API follows Controller → Service → Repository. Route handlers validate and delegate;
the recommendation service loads the candidate and invokes the pure scorer. PostgreSQL is
behind repository interfaces. The `scoring/` directory performs no I/O and a dependency
check prevents it from importing the API, repository, or database layers.

Required skills are stored in their own table because each skill carries a `mustHave` flag;
candidate skills are a PostgreSQL text array. Jobs and their required skills are inserted in
one transaction.

## Tests

```bash
npm run typecheck
npm run lint
npm run boundaries
npm test
npm run test:integration
npm run build
```

Unit tests cover the scoring branches and boundaries. Integration tests run against a real,
isolated embedded PostgreSQL cluster and cover persistence, all three endpoints, malformed
requests, ranking, limits, empty results, and lifecycle behavior.

## Scope and future work

The required API is complete and intentionally has no authentication, frontend, synonym
taxonomy, geographic distance model, or machine learning. With more time, useful additions
would be configurable weights, reverse recommendations from a job, explanations for jobs
excluded by a missing must-have, and pagination for a large catalogue. The current repository
loads all jobs before scoring, which is appropriate for this assignment's scale.

Docker is deliberately not included: the embedded database keeps setup self-contained and
avoids adding a second runtime path for a listed bonus.

## AI usage

Claude Code (Opus 5) was used for scaffolding, the scoring implementation, storage, tests,
and documentation. Codex implemented database isolation, startup and shutdown lifecycle,
the API routes, validation, endpoint tests, the seed command, and verification. The scoring
model itself was authored in the assignment documents. Suggestions that conflicted with
those decisions were reviewed and overridden; the clearest example was a proposed
position-in-range salary formula, which was rejected in favor of the specified gap-from-floor
formula. A proposed duplicate must-have check inside the skill scorer was also rejected
because the eligibility gate already owns that rule. Important tests were mutation-checked
by deliberately breaking behavior and confirming the tests failed before restoring it.
