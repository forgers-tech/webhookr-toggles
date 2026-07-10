import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const TOGGLES_PATH = resolve(ROOT, 'toggles.yaml');
export const ENVIRONMENTS_PATH = resolve(ROOT, 'config', 'environments.yaml');
export const SCHEMA_PATH = resolve(ROOT, 'schema', 'toggles.schema.json');

export interface Toggle {
  service: string;
  name: string;
  description: string;
  states: Record<string, boolean>;
}

export interface TogglesFile {
  toggles: Toggle[];
}

export interface EnvironmentDef {
  name: string;
  active: boolean;
  unleashEnvironment: string;
  unleashProject: string;
}

export interface EnvironmentsFile {
  environments: EnvironmentDef[];
}

export function loadToggles(path: string = TOGGLES_PATH): TogglesFile {
  return parse(readFileSync(path, 'utf8')) as TogglesFile;
}

export function loadEnvironments(path: string = ENVIRONMENTS_PATH): EnvironmentsFile {
  return parse(readFileSync(path, 'utf8')) as EnvironmentsFile;
}

export function loadSchema(path: string = SCHEMA_PATH): object {
  return JSON.parse(readFileSync(path, 'utf8')) as object;
}
