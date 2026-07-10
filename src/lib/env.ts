import { loadEnvironments } from './config.ts';

export interface RunConfig {
  url: string;
  token: string;
  targetEnv: string;
  unleashProject: string;
  unleashEnvironment: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Resolves the runtime configuration for apply/drift from the target logical
// environment (TARGET_ENV) plus the Git-declared Unleash mapping and the
// URL/token secrets. Keeping the environment mapping in config/environments.yaml
// (not GitHub Environment vars) keeps Git the source of truth.
export function readRunConfig(): RunConfig {
  const targetEnv = required('TARGET_ENV');
  const { environments } = loadEnvironments();
  const def = environments.find((e) => e.name === targetEnv);
  if (!def) {
    const known = environments.map((e) => e.name).join(', ');
    throw new Error(`Unknown TARGET_ENV "${targetEnv}". Known environments: ${known}`);
  }

  return {
    url: required('UNLEASH_URL').replace(/\/+$/, ''),
    token: required('UNLEASH_API_TOKEN'),
    targetEnv,
    unleashProject: def.unleashProject,
    unleashEnvironment: def.unleashEnvironment,
  };
}
