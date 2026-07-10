import { loadEnvironments } from './lib/config.ts';

// Prints a JSON array of active environment names, for the apply/drift matrix.
const { environments } = loadEnvironments();
const active = environments.filter((e) => e.active).map((e) => e.name);
process.stdout.write(JSON.stringify(active));
