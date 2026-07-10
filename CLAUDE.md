# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Overview

Declarative management of Webhookr's Unleash feature toggles. `toggles.yaml` is the source of
truth; GitHub Actions reconcile it into Unleash. This is a small Node.js/TypeScript tooling repo
— not a service. See `README.md` for user-facing usage.

## General rules

- **Never invent or assume any information.** If a requirement, an Unleash API behavior, or an
  expected state is unclear, stop and ask before proceeding.
- **Everything in English** (code, comments, commit messages, PR titles/descriptions).
- A merge to `main` changes live Unleash via the Apply Toggles workflow. Review blast radius;
  `prd` applies are gated by the `prd` GitHub Environment.

## Core invariants

- **Naming:** the final Unleash flag is `webhookr.<service>.<name>`. The environment is never in
  the name. This convention lives in exactly one place — `src/lib/toggle-name.ts`. Reuse it;
  never re-derive the string elsewhere.
- **Single Unleash instance, env-name mapping.** Logical environments (`prd`, `qa`) map to
  Unleash environments via `config/environments.yaml` (`unleashEnvironment` / `unleashProject`).
  Keep that mapping in Git, not in GitHub Environment variables.
- **YAML is authoritative; never delete.** Apply reconciles only declared flags and never removes
  flags absent from `toggles.yaml`. Drift reports undeclared Unleash flags as warnings only.
- **Idempotent apply.** Read current state; write only on a diff.

## Runtime & TypeScript

- Node 24 runs the `.ts` files directly via **type-stripping (strip-only mode)**. This forbids
  TypeScript syntax that requires transformation: **no parameter properties**
  (`constructor(private x)`), **no `enum`**, **no `namespace`**, no experimental decorators.
  Use explicit field assignment instead.
- Relative imports use the **`.ts` extension** (`./lib/config.ts`).
- Type-only imports **must** be `import type` (enforced by ESLint `consistent-type-imports`),
  otherwise type-stripping leaves a broken runtime import.
- `tsc --noEmit` is a type-checker only (module resolution `bundler`); nothing is compiled.
- Prefer native Node APIs (`fetch`, `node:test`) over new dependencies. Pin every dependency to
  an exact version; commit `package-lock.json` alongside `package.json`.

## Layout

```
toggles.yaml                 # declared toggles + per-env states
config/environments.yaml     # logical envs, active flag, Unleash mapping
schema/toggles.schema.json   # JSON Schema for structural validation
src/lib/                     # toggle-name, config, env, unleash (admin API wrapper)
src/validate.ts              # offline validation (schema + semantic)
src/apply.ts                 # reconcile one environment (supports --dry-run)
src/drift.ts                 # compare one environment
src/list-active-envs.ts      # emits the active-env matrix for workflows
scripts/set-state.ts         # edits toggles.yaml preserving formatting (Manage Toggle State)
```

## Workflows

- `validate-toggles` (PR) — the required check is the job named **Validate Toggles**. If you
  rename that job, update `github_required_checks` in `forgers-tech/terraform`.
- `apply-toggles` — auto on merge (active envs) + manual dispatch (`environment`, `dry_run`).
- `manage-toggle-state` — flips one toggle and opens a PR (uses `TOGGLES_PR_PAT` so PR checks
  run; GITHUB_TOKEN-opened PRs do not trigger `pull_request`).
- `drift-detection` — daily + manual; read-only (no GitHub Environment gate).

## Testing

`npm test` runs `node --test` over `test/**/*.test.ts`. Cover the naming convention and
validation rules. For apply/drift changes, verify end-to-end against a local Unleash
(`unleashorg/unleash-server:8.0.1` + Postgres) before relying on CI.

## Artifacts workflow (source of truth)

`webhookr-artifacts` is the long-term source of truth. Before changing behavior, read the
relevant engineering artifact; after a meaningful change, apply the `artifact-reconciliation`
standard and update the corresponding ADR/runbook, explaining **why**.

## Branch & working-tree hygiene

Start and finish on a clean tree. Branch from a fresh `main` (`<type>/<short-slug>`), one PR per
concern, never push directly to `main`, and delete the branch after merge.
