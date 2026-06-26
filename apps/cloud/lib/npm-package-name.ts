/** Valid npm package name (scoped or unscoped) — mirrors src/clients/npm-registry-client.ts */
export function isValidNpmPackageName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 214) return false;
  const scoped = /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/i;
  const unscoped = /^[a-z0-9-~][a-z0-9-._~]*$/i;
  return scoped.test(trimmed) || unscoped.test(trimmed);
}
