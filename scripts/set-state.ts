import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument, type YAMLMap, type YAMLSeq } from 'yaml';
import { loadEnvironments, TOGGLES_PATH } from '../src/lib/config.ts';
import { isService } from '../src/lib/toggle-name.ts';

// Flips one toggle's state for one environment in toggles.yaml, preserving
// comments and formatting (parseDocument). Used by the Manage Toggle State
// workflow, which then opens a PR. Fails loudly if the toggle does not exist.
function main(): void {
  const [envName, service, name, state] = process.argv.slice(2);

  if (!envName || !service || !name || !state) {
    throw new Error('usage: set-state <environment> <service> <toggle-name> <on|off>');
  }
  if (state !== 'on' && state !== 'off') {
    throw new Error(`state must be "on" or "off", got "${state}"`);
  }
  if (!isService(service)) {
    throw new Error(`unknown service "${service}"`);
  }

  const { environments } = loadEnvironments();
  if (!environments.some((e) => e.name === envName)) {
    const known = environments.map((e) => e.name).join(', ');
    throw new Error(`unknown environment "${envName}". Known: ${known}`);
  }

  const doc = parseDocument(readFileSync(TOGGLES_PATH, 'utf8'));
  const toggles = doc.get('toggles') as YAMLSeq | undefined;
  const match = toggles?.items.find((item) => {
    const node = item as YAMLMap;
    return node.get('service') === service && node.get('name') === name;
  }) as YAMLMap | undefined;

  if (!match) {
    throw new Error(`toggle "${service}.${name}" not found in toggles.yaml`);
  }

  match.setIn(['states', envName], state === 'on');
  writeFileSync(TOGGLES_PATH, doc.toString());
  console.log(`set ${service}.${name} ${envName} -> ${state}`);
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
