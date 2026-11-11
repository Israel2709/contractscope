# ContractScope — Persistent Project Context

> Handoff document for AI-assisted and human development.
> Treat this as documented project state. Verify against the actual repository when conflicts arise.

---

## Project Identity

- **Name:** ContractScope
- **Short description:** Developer tooling that detects breaking and non-breaking changes between OpenAPI contract versions.
- **Core purpose:** Compare two OpenAPI documents, classify compatibility impact, and report results via CLI (terminal + JSON).
- **Problems solved:** Accidental API regressions, unclear contract diffs, missing automated compatibility checks in CI/local workflows.
- **Audience:** Backend/frontend engineers, API authors, platform teams integrating contract checks into pipelines.

---

## Project Goals

### Short-term (MVP) — complete

- Parse OpenAPI 3.0 / 3.1 (YAML + JSON).
- Normalize supported definitions (paths, operations, parameters, request bodies, response schemas).
- Diff two contract versions with deterministic output.
- Classify changes as `breaking` | `warning` | `non-breaking`.
- Provide terminal and JSON reports through a thin CLI.
- Ship meaningful automated tests and documentation.

### Long-term (not in current scope)

- Frontend TypeScript AST / React impact analysis.
- Advanced schema compatibility (`allOf`/`oneOf`/`anyOf`, polymorphism, etc.).
- Interactive dashboard, GitHub Actions integration, incremental analysis.

---

## Technology Stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Runtime | Node.js 22+ | Modern LTS features, native ESM support |
| Language | TypeScript (strict) | Maintainable typed domain logic |
| Monorepo | pnpm workspaces | Fast installs, clear package boundaries |
| Validation | Zod | Lightweight runtime schema validation for OpenAPI basics |
| YAML | yaml | Reliable YAML 1.2 parsing |
| CLI | Commander | Standard, thin CLI framework |
| Build | tsup | Fast ESM/CJS library builds |
| Tests | Vitest | Fast TypeScript-native unit/integration tests |
| Quality | ESLint + Prettier | Consistent style and static checks |

---

## Architecture Overview

Two packages:

1. **`@contractscope/core`** — reusable domain library
   - `parser` — load, validate, resolve local `$ref`
   - `normalizer` — produce stable `NormalizedContract`
   - `diff` — structural comparison of normalized contracts
   - `classifier` — severity rules (request vs response awareness)
   - `reporter` — terminal + JSON formatters
   - `types` — shared domain types
   - `analyze.ts` — high-level `analyzeFiles` / `analyzeContracts` API

2. **`@contractscope/cli`** — thin Commander CLI over core (`analyze` command)

**Principles:** core independent of CLI; deterministic analysis; explicit unsupported constructs; no speculative abstractions.

Data flow: `file → parse → normalize → diff → classify → report`.

See `docs/architecture.md` for detailed design.

---

## Repository Structure

```text
contractscope/
├── .cursor/rules/project-context.mdc
├── packages/
│   ├── core/
│   │   ├── src/{parser,normalizer,diff,classifier,reporter,types,analyze.ts,index.ts}
│   │   └── tests/{parser,diff}.test.ts
│   └── cli/
│       ├── src/{commands,utils,index.ts}
│       └── tests/analyze.test.ts
├── fixtures/{api-v1.yaml,api-v2.yaml,api-v1.json}
├── docs/architecture.md
├── context.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── .prettierrc
└── .gitignore
```

---

## Core Domain Concepts

- **NormalizedContract** — canonical internal representation after parse + `$ref` resolution.
- **ContractChange** — single detected change with `id`, `type`, `severity`, `path`, optional `method`.
- **AnalysisResult** — summary counts + ordered list of changes.
- **Severities:**
  - `breaking` — likely breaks existing clients
  - `warning` — indeterminate / partially supported construct
  - `non-breaking` — additive or safely removable for consumers under MVP rules

Request compatibility (client → server) is treated separately from response compatibility (server → client).

---

## Implemented Features

- [x] pnpm workspace with `@contractscope/core` and `@contractscope/cli`
- [x] Persistent context system (`context.md` + `.cursor/rules/project-context.mdc`)
- [x] OpenAPI 3.0/3.1 YAML + JSON loading and basic validation
- [x] Local `$ref` resolution with JSON Pointer escaping, cycle + remote-ref detection
- [x] Normalization of paths, operations, parameters (incl. path-level), request bodies, responses
- [x] Deterministic contract diff + severity classification
- [x] Terminal and JSON reporters
- [x] CLI `analyze` with `--format`, `--output`, `--fail-on-breaking`, `--help`, `--version`
- [x] Fixtures demonstrating breaking and non-breaking changes
- [x] Automated tests (23 passing: 17 core + 6 CLI)
- [x] README + architecture docs

---

## Current Development Status

- **Phase:** Phase 5 — Quality and Readiness (MVP complete)
- **Last completed milestone:** Full MVP verified (install, build, test, lint, typecheck, CLI)
- **Current active task:** none
- **Blockers:** none
- **Verification results (2026-03-24):**
  - `pnpm install` — success
  - `pnpm build` — success
  - `pnpm test` — 23/23 passed
  - `pnpm lint` — success
  - `pnpm typecheck` — success
  - CLI terminal analysis of fixtures — success (19 changes: 10 breaking, 9 non-breaking)
  - CLI `--fail-on-breaking` — exit code `1` as expected
- **Next recommended task:** Expand schema compatibility for `allOf`/`oneOf`/`anyOf` with explicit warning/classification rules (still within contract-analysis scope; not frontend AST)

---

## Pending Tasks

| Status | Task | Notes |
| --- | --- | --- |
| DONE | Phase 1 — Foundation | workspace, packages, context, rules, docs |
| DONE | Phase 2 — Contract Parsing | load, validate, normalize, local `$ref` |
| DONE | Phase 3 — Compatibility Analysis | diff + classify + stable results |
| DONE | Phase 4 — CLI | analyze, reporters, exit codes |
| DONE | Phase 5 — Quality and Readiness | verified gates; context synced |
| TODO | Deeper schema composition support | `allOf`/`oneOf`/`anyOf` analysis |
| TODO | Enum / format compatibility rules | currently limited |
| TODO | Future: frontend AST impact analysis | out of MVP scope |
| TODO | Future: CI GitHub Action packaging | out of MVP scope |

---

## Architecture Decision Log

### ADR-001 — Monorepo with core + cli packages

- **Date:** 2026-03-24
- **Context:** Need reusable analysis library and a thin CLI.
- **Decision:** pnpm workspace with `@contractscope/core` and `@contractscope/cli`.
- **Alternatives considered:** Single package; separate repos.
- **Rationale:** Independent reuse of core; clear separation of concerns.
- **Consequences:** Workspace dependency wiring; dual build configs.

### ADR-002 — Local `$ref` only

- **Date:** 2026-03-24
- **Context:** Remote refs add network, caching, and security complexity.
- **Decision:** Resolve only local document `$ref` (JSON Pointer). Reject remote refs with clear errors.
- **Alternatives considered:** Full remote fetch; ignore unresolved refs.
- **Rationale:** Correctness and security for MVP.
- **Consequences:** Multi-file / remote specs unsupported until a later phase.

### ADR-003 — Severity model with warnings for uncertainty

- **Date:** 2026-03-24
- **Context:** Advanced schemas cannot always be classified confidently.
- **Decision:** Use `breaking` | `warning` | `non-breaking`; prefer `warning` when unsure.
- **Alternatives considered:** Binary breaking/non-breaking only.
- **Rationale:** Avoid false confidence.
- **Consequences:** Consumers must decide how to treat warnings.

### ADR-004 — Root workspace depends on CLI for bin linking

- **Date:** 2026-03-24
- **Context:** On Windows/pnpm, `pnpm --filter @contractscope/cli exec contractscope` did not initially resolve the package’s own bin until the CLI was linked from the workspace root.
- **Decision:** Add `@contractscope/cli` as a root `devDependency` (`workspace:*`) so `contractscope` is available via `pnpm exec` / filter exec after install+build.
- **Alternatives considered:** Only document `node packages/cli/dist/index.js`.
- **Rationale:** Matches the intended UX in the definition of done.
- **Consequences:** Root package depends on the CLI package for local development.

---

## Known Limitations

- No remote `$ref` fetching.
- Limited advanced schema support (`allOf`/`oneOf`/`anyOf`, discriminators, complex composition → recorded as `unsupportedFeatures`; comparison may emit warnings).
- Enum widening/narrowing and format-only changes are not fully classified.
- No frontend impact analysis.
- No dashboard / published npm release workflow yet.
- Parameter `content` (non-schema) media types are not modeled beyond basic `schema`.

---

## Testing and Validation

### Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

CLI examples:

```bash
pnpm exec contractscope analyze \
  --before ./fixtures/api-v1.yaml \
  --after ./fixtures/api-v2.yaml \
  --format terminal

pnpm --filter @contractscope/cli exec contractscope analyze \
  --before ../../fixtures/api-v1.yaml \
  --after ../../fixtures/api-v2.yaml \
  --format terminal
```

### Current test status

**Verified:** 23 tests passed (core 17, cli 6). Build, lint, and typecheck succeeded.

### Known testing gaps

- No dedicated warning-path fixture asserting `allOf` warning emission end-to-end.
- No published-package smoke test outside the workspace.

---

## Development Roadmap

1. **Phase 1 — Foundation** — DONE
2. **Phase 2 — Contract Parsing** — DONE
3. **Phase 3 — Compatibility Analysis** — DONE
4. **Phase 4 — CLI** — DONE
5. **Phase 5 — Quality and Readiness** — DONE
6. **Next (optional):** deeper schema composition + enum/format rules
7. **Future** — frontend AST, dashboard, GHA (do not implement unless requested)

---

## AI Assistant Handoff Instructions

1. Read this file (`context.md`) at the start of every task.
2. Verify claims against source, tests, and configs — this document can lag.
3. Do not expand into future roadmap features unless explicitly requested.
4. After meaningful work: update Implemented Features, Pending Tasks, Current Development Status, Testing and Validation, and Session Handoff.
5. Never mark work DONE without implementation + appropriate verification.

---

## Session Handoff

- **Work completed:** Full MVP foundation — context system, core parser/normalizer/diff/classifier/reporter, CLI, fixtures, docs, and verification.
- **Files changed:** Entire `contractscope/` project tree (see Repository Structure).
- **Tests executed:** `pnpm test` → 23/23 passed; `pnpm build`, `pnpm lint`, `pnpm typecheck` → success; CLI fixture analysis → 10 breaking / 9 non-breaking; `--fail-on-breaking` → exit 1.
- **Unresolved problems:** none blocking
- **Recommended next action:** Implement deeper OpenAPI schema composition compatibility (`allOf`/`oneOf`/`anyOf`) with tests, or wait for an explicit product priority.
