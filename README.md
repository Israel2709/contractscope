# ContractScope

ContractScope detects breaking and non-breaking changes between OpenAPI contract versions and reports compatibility risks from the command line.

Backend teams often evolve APIs without a clear view of client impact. ContractScope compares two OpenAPI 3.0/3.1 documents, classifies each change, and produces terminal or JSON reports suitable for local development and CI.

## Current Features

- Parse OpenAPI 3.0 and 3.1 contracts (YAML and JSON)
- Resolve local `$ref` references (JSON Pointer, cycle detection)
- Normalize paths, operations, parameters, request bodies, and response schemas
- Diff contract versions with deterministic output
- Classify changes as `breaking`, `warning`, or `non-breaking`
- CLI with terminal and JSON reporters
- `--fail-on-breaking` exit codes for CI gates

## Installation

Requirements: **Node.js 22+** and **pnpm**.

```bash
pnpm install
pnpm build
```

## Usage

```bash
# From the repository root (after pnpm install && pnpm build)
pnpm exec contractscope analyze \
  --before ./fixtures/api-v1.yaml \
  --after ./fixtures/api-v2.yaml \
  --format terminal

# Equivalent via package filter
pnpm --filter @contractscope/cli exec contractscope analyze \
  --before ../../fixtures/api-v1.yaml \
  --after ../../fixtures/api-v2.yaml \
  --format terminal
```

### Options

| Option | Description |
| --- | --- |
| `--before <path>` | Baseline OpenAPI contract (required) |
| `--after <path>` | Candidate OpenAPI contract (required) |
| `--format terminal\|json` | Output format (default: `terminal`) |
| `--output <path>` | Write the report to a file |
| `--fail-on-breaking` | Exit with code `1` when breaking changes exist |
| `--help` / `--version` | Standard CLI help and version |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success (no failure condition triggered) |
| `1` | Breaking changes found and `--fail-on-breaking` was set |
| `2` | Runtime / validation error |

### Example terminal output

```text
ContractScope Analysis Report
================================

Total changes:        12
Breaking changes:     6
Warnings:             0
Non-breaking changes: 6

BREAKING (6)
----------------------------------------
  [BREAKING] endpoint.removed
    /users/{id}/roles
    Removed endpoint /users/{id}/roles
...
```

### JSON output

```bash
pnpm --filter @contractscope/cli exec contractscope analyze \
  --before ./fixtures/api-v1.yaml \
  --after ./fixtures/api-v2.yaml \
  --format json \
  --output ./report.json
```

## Library usage

```ts
import { analyzeFiles, formatTerminalReport } from "@contractscope/core";

const result = await analyzeFiles({
  beforePath: "./fixtures/api-v1.yaml",
  afterPath: "./fixtures/api-v2.yaml",
});

console.log(formatTerminalReport(result));
```

## Testing

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Known Limitations

- Remote / external `$ref` values are not fetched
- Advanced schema composition (`allOf`, `oneOf`, `anyOf`, discriminators) is not fully analyzed; presence is reported as a warning when encountered during schema comparison
- No frontend TypeScript/React impact analysis yet
- No interactive dashboard

See `docs/architecture.md` and `context.md` for details.

## Future Roadmap

- Frontend TypeScript AST analysis
- React component impact detection
- Deeper OpenAPI schema compatibility
- Interactive dashboard
- GitHub Actions packaging
- Incremental analysis for large repositories

## Project layout

```text
packages/core   Reusable parsing, diff, classification, reporting
packages/cli    Commander CLI
fixtures/       Sample OpenAPI contracts
docs/           Architecture documentation
context.md      Persistent AI/human development handoff
```

## License

MIT (planned for open-source release; confirm before publishing).
