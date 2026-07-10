import type { RunConfig } from './env.ts';

export interface FeatureEnvironment {
  name: string;
  enabled: boolean;
  strategies?: unknown[];
}

export interface Feature {
  name: string;
  description?: string;
  environments?: FeatureEnvironment[];
}

// Thin wrapper over the Unleash admin API (v8.0.1 / OSS). `config.url` already
// includes the `/api` base; admin routes live under `/api/admin`. Admin tokens
// are sent as the raw Authorization header value (no `Bearer` prefix).
export class UnleashClient {
  // Explicit field assignment (not a TS parameter property): Node runs .ts via
  // type-stripping (strip-only), which does not support parameter properties.
  private readonly config: RunConfig;

  constructor(config: RunConfig) {
    this.config = config;
  }

  private get base(): string {
    return `${this.config.url}/admin/projects/${this.config.unleashProject}`;
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: this.config.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res;
  }

  private async expectOk(res: Response, action: string): Promise<void> {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Unleash ${action} failed: ${res.status} ${res.statusText} ${text}`.trim());
    }
  }

  async listFeatures(): Promise<Feature[]> {
    const res = await this.request('GET', '/features');
    await this.expectOk(res, 'list features');
    const body = (await res.json()) as { features?: Feature[] };
    return body.features ?? [];
  }

  async getFeature(name: string): Promise<Feature | null> {
    const res = await this.request('GET', `/features/${encodeURIComponent(name)}`);
    if (res.status === 404) {
      return null;
    }
    await this.expectOk(res, `get feature ${name}`);
    return (await res.json()) as Feature;
  }

  async createFeature(name: string, description: string): Promise<void> {
    const res = await this.request('POST', '/features', { name, description });
    await this.expectOk(res, `create feature ${name}`);
  }

  async updateDescription(name: string, description: string): Promise<void> {
    const res = await this.request('PATCH', `/features/${encodeURIComponent(name)}`, [
      { op: 'replace', path: '/description', value: description },
    ]);
    await this.expectOk(res, `update description for ${name}`);
  }

  async setEnabled(name: string, enabled: boolean): Promise<void> {
    const env = encodeURIComponent(this.config.unleashEnvironment);
    const feature = encodeURIComponent(name);
    const action = enabled ? 'on' : 'off';
    const res = await this.request('POST', `/features/${feature}/environments/${env}/${action}`);
    await this.expectOk(res, `set ${name} ${action}`);
  }

  // An enabled environment with zero strategies does not serve `true` in
  // Unleash, so ensure a full-rollout default strategy exists before enabling.
  // Idempotent: only adds a strategy when the environment has none.
  async ensureDefaultStrategy(feature: Feature, name: string): Promise<void> {
    const envState = this.environmentState(feature);
    if (envState && (envState.strategies?.length ?? 0) > 0) {
      return;
    }
    const env = encodeURIComponent(this.config.unleashEnvironment);
    const res = await this.request(
      'POST',
      `/features/${encodeURIComponent(name)}/environments/${env}/strategies`,
      {
        name: 'flexibleRollout',
        parameters: { rollout: '100', stickiness: 'default', groupId: name },
      },
    );
    await this.expectOk(res, `add default strategy for ${name}`);
  }

  environmentState(feature: Feature): FeatureEnvironment | undefined {
    return feature.environments?.find((e) => e.name === this.config.unleashEnvironment);
  }

  isEnabled(feature: Feature): boolean {
    return this.environmentState(feature)?.enabled ?? false;
  }
}
