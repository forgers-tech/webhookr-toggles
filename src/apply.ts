import { fileURLToPath } from 'node:url';
import { loadToggles } from './lib/config.ts';
import { readRunConfig } from './lib/env.ts';
import { finalName } from './lib/toggle-name.ts';
import { UnleashClient } from './lib/unleash.ts';

// Reconciles every declared toggle into Unleash for the target environment.
// Idempotent: reads current state and only writes on a diff. Never deletes
// flags that are absent from toggles.yaml.
async function apply(dryRun: boolean): Promise<void> {
  const config = readRunConfig();
  const client = new UnleashClient(config);
  const { toggles } = loadToggles();

  const prefix = dryRun ? '[dry-run] ' : '';
  console.log(
    `${prefix}Applying ${toggles.length} toggle(s) to project "${config.unleashProject}" ` +
      `environment "${config.unleashEnvironment}" (${config.targetEnv}) at ${config.url}`,
  );

  let changes = 0;
  for (const toggle of toggles) {
    const name = finalName(toggle.service, toggle.name);
    const desired = toggle.states[config.targetEnv] ?? false;

    let feature = await client.getFeature(name);

    if (!feature) {
      changes++;
      console.log(`${prefix}create ${name}`);
      if (!dryRun) {
        await client.createFeature(name, toggle.description);
        feature = await client.getFeature(name);
      }
    } else if ((feature.description ?? '') !== toggle.description) {
      changes++;
      console.log(`${prefix}update description ${name}`);
      if (!dryRun) {
        await client.updateDescription(name, toggle.description);
      }
    }

    if (desired && feature && !dryRun) {
      await client.ensureDefaultStrategy(feature, name);
    }

    const current = feature ? client.isEnabled(feature) : false;
    if (current !== desired) {
      changes++;
      console.log(`${prefix}set ${name} -> ${desired ? 'on' : 'off'}`);
      if (!dryRun) {
        await client.setEnabled(name, desired);
      }
    }
  }

  console.log(`${prefix}done (${changes} change(s)${dryRun ? ' planned' : ' applied'})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  apply(process.argv.includes('--dry-run')).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
