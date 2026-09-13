/**
 * The scorer is the deliverable, and it is a pure function.
 *
 * Keeping it free of storage, transport and framework is what lets the whole of it be
 * tested in milliseconds with no fixtures — which matters here because the brief names
 * scoring tests as the highest-value place to test. These rules make that a build
 * failure rather than an intention.
 */
module.exports = {
  forbidden: [
    {
      name: 'scoring-is-pure',
      comment:
        'scoring/ decides a score from a candidate and a job. It must not know where either came from.',
      severity: 'error',
      from: { path: '^src/scoring' },
      to: { path: '^src/(api|repository|db)' },
    },
    {
      name: 'domain-depends-on-nothing',
      comment: 'domain/ is types and vocabularies. Everything may depend on it; it depends on nothing.',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(api|repository|db|scoring|config)' },
    },
    {
      name: 'routes-must-not-touch-storage',
      comment: 'Controllers delegate to the repository interface; they never reach past it.',
      severity: 'error',
      from: { path: '^src/api' },
      to: { path: '^src/db' },
    },
    {
      name: 'no-circular',
      comment: 'Cycles make modules impossible to reason about in isolation.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    includeOnly: '^src',
  },
};
