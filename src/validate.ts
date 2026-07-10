import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { loadEnvironments, loadSchema, loadToggles, type Toggle } from './lib/config.ts';
import { finalName, isService, isValidToggleName } from './lib/toggle-name.ts';

// Offline validation: never contacts Unleash. Returns the list of human-readable
// errors so it can be reused by tests; the CLI entrypoint exits non-zero on any.
export function validate(): string[] {
  const errors: string[] = [];

  const toggles = loadToggles();
  const { environments } = loadEnvironments();
  const envNames = environments.map((e) => e.name);

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const check = ajv.compile(loadSchema());
  if (!check(toggles)) {
    for (const err of check.errors ?? []) {
      errors.push(`schema: ${err.instancePath || '/'} ${err.message ?? 'invalid'}`);
    }
    // Structural errors make semantic checks unreliable; stop here.
    return errors;
  }

  const seen = new Map<string, number>();

  toggles.toggles.forEach((toggle: Toggle, index: number) => {
    const where = `toggles[${index}] (${toggle.service}.${toggle.name})`;

    if (!isService(toggle.service)) {
      errors.push(`${where}: unknown service "${toggle.service}"`);
    }
    if (!isValidToggleName(toggle.name)) {
      errors.push(`${where}: name "${toggle.name}" must be lowercase kebab-case`);
    }
    if (toggle.description.trim().length === 0) {
      errors.push(`${where}: description must not be empty`);
    }

    // Every declared environment must have an explicit boolean state, and no
    // states may reference an unknown environment.
    for (const env of envNames) {
      if (typeof toggle.states[env] !== 'boolean') {
        errors.push(`${where}: missing explicit state for environment "${env}"`);
      }
    }
    for (const stateEnv of Object.keys(toggle.states)) {
      if (!envNames.includes(stateEnv)) {
        errors.push(`${where}: state for unknown environment "${stateEnv}"`);
      }
    }

    const full = finalName(toggle.service, toggle.name);
    const prev = seen.get(full);
    if (prev !== undefined) {
      errors.push(`${where}: duplicate toggle "${full}" (also toggles[${prev}])`);
    } else {
      seen.set(full, index);
    }
  });

  return errors;
}

function main(): void {
  const errors = validate();
  if (errors.length > 0) {
    console.error(`✖ toggles validation failed (${errors.length} error(s)):`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  console.log('✓ toggles.yaml is valid');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
