# webhookr-toggles

Declarative, Git-sourced management of Webhookr's [Unleash](https://www.getunleash.io/)
feature toggles. Git is the source of truth for **which toggles exist**, **which service owns
them**, **their expected state per environment**, and **which environment they apply to**.
GitHub Actions reconcile that declaration into Unleash.

## How it works

- [`toggles.yaml`](toggles.yaml) declares every toggle and its per-environment state.
- [`config/environments.yaml`](config/environments.yaml) lists the logical environments
  (`prd`, `qa`) and maps each onto the shared Unleash server.
- The final Unleash flag name is computed as **`webhookr.<service>.<name>`** — the environment is
  never part of the name, because environments are distinguished inside Unleash.
- Workflows validate on PR, apply on merge, flip state via PR, and detect drift.

Webhookr runs a **single Unleash instance**; environments are Unleash's own
(`project:environment`) concept, not separate servers. `prd` maps to the `production` Unleash
environment (see `config/environments.yaml`).

### Naming convention

```
webhookr.<service>.<name>
```

- **service** — one of `web`, `bff`, `svc`, `ingest`.
- **name** — lowercase kebab-case (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`).

Examples: `webhookr.web.new-dashboard`, `webhookr.svc.processor-engine`.

## Common tasks

### Add a toggle

1. Add an entry to [`toggles.yaml`](toggles.yaml):

   ```yaml
   - service: svc
     name: my-feature
     description: What this feature does.
     states:
       prd: false
       qa: false
   ```

2. Open a PR. **Validate Toggles** runs automatically.
3. On merge, **Apply Toggles** creates the flag (disabled) in every active environment.

Every toggle must declare an explicit boolean state for **every** environment in
`config/environments.yaml`, or validation fails.

### Turn a toggle on/off

Prefer the workflow (it keeps the change auditable and revertable):

- Actions → **Manage Toggle State** → Run workflow → choose `environment`, `service`,
  `toggle_name`, and `state` (`on`/`off`).
- It edits `toggles.yaml` and opens a PR. Review and merge → **Apply Toggles** applies it.

You can also edit `toggles.yaml` by hand and open a PR — same result.

### Apply to an environment

- **Automatically:** merging to `main` applies every **active** environment
  (`active: true` in `config/environments.yaml`). `prd` is gated by the `prd` GitHub Environment.
- **Manually:** Actions → **Apply Toggles** → Run workflow → pick an `environment` and,
  optionally, `dry_run` to preview the plan without writing.

Apply is **idempotent**: it reads current state and only writes on a diff. It **never deletes**
flags that are absent from `toggles.yaml`.

### Detect drift

- **Scheduled:** runs daily and fails if Unleash diverges from `toggles.yaml`.
- **Manually:** Actions → **Drift Detection** → Run workflow → pick an `environment`.

Drift reports missing flags, wrong state, and wrong description as **actionable** (fails the run).
Flags present in Unleash but not declared here are reported as **warnings** only — this repo
manages exactly what it declares.

### Recover an empty Unleash

If an Unleash environment is wiped or rebuilt, run **Apply Toggles** for that environment (or
`npm run apply` locally). Apply recreates every declared flag, ensures a full-rollout default
strategy where the state is `on`, and sets each flag's state — restoring the declared world.

### Roll back

Revert the commit that changed a state and merge. **Apply Toggles** restores the previous
declared state (apply is a pure function of `toggles.yaml`).

## Local development

Requires Node.js 24+ (runs the TypeScript CLIs directly via type-stripping — no build step).

```bash
npm ci
npm run validate          # offline schema + semantic validation
cp .env.example .env       # set UNLEASH_URL, UNLEASH_API_TOKEN, TARGET_ENV
npm run apply -- --dry-run # preview against the configured Unleash
npm run apply              # apply
npm run drift              # compare
```

`npm run typecheck`, `npm run lint`, and `npm test` mirror the PR checks.

## Configuration

Provisioned by Terraform (`forgers-tech/terraform`), not set by hand:

| Name | Scope | Purpose |
| --- | --- | --- |
| `UNLEASH_URL` | repo secret | Unleash admin API base (includes `/api`) |
| `UNLEASH_API_TOKEN` | repo secret | Unleash **admin** token (creates flags + flips state) |
| `TOGGLES_PR_PAT` | repo secret | opens the Manage-Toggle-State PR so PR checks run |
| `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` | repo secret | Tailscale OAuth client; Apply/Drift join the tailnet (`tag:ci`) to reach the tailnet-only Unleash admin API |
| GitHub Environments `prd`, `qa` | environment | scopes applies to the environment (no reviewers) |

The `prd → production` mapping (project `default`, environment `production`) lives in
`config/environments.yaml` (Git is the source of truth). Unleash OSS supports only the `default`
project, so flags are namespaced by the `webhookr.<service>.<name>` convention rather than by a
separate project.
