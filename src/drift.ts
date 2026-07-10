import { fileURLToPath } from 'node:url';
import { loadToggles } from './lib/config.ts';
import { readRunConfig } from './lib/env.ts';
import { finalName } from './lib/toggle-name.ts';
import { UnleashClient } from './lib/unleash.ts';

// Compares toggles.yaml against Unleash for the target environment.
// Actionable drift (missing / state / description) fails the run so scheduled
// alerting fires. Unleash-only flags are reported as warnings and never fail —
// this repo manages only the flags it declares and never deletes.
async function detectDrift(): Promise<void> {
  const config = readRunConfig();
  const client = new UnleashClient(config);
  const { toggles } = loadToggles();

  const actionable: string[] = [];
  const warnings: string[] = [];
  const managed = new Set<string>();

  for (const toggle of toggles) {
    const name = finalName(toggle.service, toggle.name);
    managed.add(name);
    const desired = toggle.states[config.targetEnv] ?? false;

    const feature = await client.getFeature(name);
    if (!feature) {
      actionable.push(`missing in Unleash: ${name}`);
      continue;
    }
    if ((feature.description ?? '') !== toggle.description) {
      actionable.push(`description differs: ${name}`);
    }
    const current = client.isEnabled(feature);
    if (current !== desired) {
      actionable.push(
        `state differs: ${name} is ${current ? 'on' : 'off'}, expected ${desired ? 'on' : 'off'}`,
      );
    }
  }

  for (const feature of await client.listFeatures()) {
    if (!managed.has(feature.name) && feature.name.startsWith('webhookr.')) {
      warnings.push(`extra in Unleash (unmanaged): ${feature.name}`);
    }
  }

  console.log(
    `Drift report for project "${config.unleashProject}" environment ` +
      `"${config.unleashEnvironment}" (${config.targetEnv}):`,
  );
  for (const warning of warnings) {
    console.log(`  ⚠ ${warning}`);
  }
  for (const item of actionable) {
    console.log(`  ✖ ${item}`);
  }

  if (actionable.length === 0) {
    console.log(warnings.length > 0 ? '✓ no actionable drift (warnings only)' : '✓ in sync');
    return;
  }
  console.error(`✖ ${actionable.length} actionable drift item(s)`);
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  detectDrift().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
