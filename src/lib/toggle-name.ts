export const SERVICES = ['web', 'bff', 'svc', 'ingest'] as const;
export type Service = (typeof SERVICES)[number];

export const NAME_PREFIX = 'webhookr';
export const TOGGLE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function isService(value: string): value is Service {
  return (SERVICES as readonly string[]).includes(value);
}

export function isValidToggleName(name: string): boolean {
  return TOGGLE_NAME_PATTERN.test(name);
}

// Single place the naming convention lives: webhookr.<service>.<name>.
export function finalName(service: string, name: string): string {
  return `${NAME_PREFIX}.${service}.${name}`;
}
