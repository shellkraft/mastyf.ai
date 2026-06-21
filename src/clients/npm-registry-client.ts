/**
 * Lightweight npm registry client for package existence + version resolution.
 */

export type NpmPackageMeta = {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: string;
};

export class NpmPackageNotFoundError extends Error {
  constructor(packageName: string) {
    super(`Package not found on npm: ${packageName}`);
    this.name = 'NpmPackageNotFoundError';
  }
}

/** Valid npm package name (scoped or unscoped). */
export function isValidNpmPackageName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 214) return false;
  const scoped = /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/i;
  const unscoped = /^[a-z0-9-~][a-z0-9-._~]*$/i;
  return scoped.test(trimmed) || unscoped.test(trimmed);
}

function registryUrl(packageName: string, version?: string): string {
  const encoded = encodeURIComponent(packageName);
  if (version && version !== 'latest') {
    return `https://registry.npmjs.org/${encoded}/${encodeURIComponent(version)}`;
  }
  return `https://registry.npmjs.org/${encoded}`;
}

function pickVersion(doc: Record<string, unknown>, requested?: string): string {
  if (requested && requested !== 'latest') return requested;
  const distTags = doc['dist-tags'] as Record<string, string> | undefined;
  if (distTags?.latest) return distTags.latest;
  const versions = doc.versions as Record<string, unknown> | undefined;
  if (versions) {
    const keys = Object.keys(versions).sort();
    if (keys.length) return keys[keys.length - 1]!;
  }
  throw new NpmPackageNotFoundError(String(doc.name ?? 'unknown'));
}

function metaFromVersionDoc(
  packageName: string,
  version: string,
  doc: Record<string, unknown>,
): NpmPackageMeta {
  const repo = doc.repository as { url?: string } | string | undefined;
  const repoUrl = typeof repo === 'string' ? repo : repo?.url;
  return {
    name: String(doc.name ?? packageName),
    version: String(doc.version ?? version),
    description: typeof doc.description === 'string' ? doc.description : undefined,
    homepage: typeof doc.homepage === 'string' ? doc.homepage : undefined,
    repository: repoUrl,
  };
}

export async function fetchNpmPackage(
  packageName: string,
  version?: string,
): Promise<NpmPackageMeta> {
  const name = packageName.trim();
  if (!isValidNpmPackageName(name)) {
    throw new Error('invalid_package_name');
  }

  if (version && version !== 'latest') {
    const res = await fetch(registryUrl(name, version));
    if (res.status === 404) throw new NpmPackageNotFoundError(name);
    if (!res.ok) throw new Error(`npm_registry_error:${res.status}`);
    const doc = (await res.json()) as Record<string, unknown>;
    return metaFromVersionDoc(name, version, doc);
  }

  const res = await fetch(registryUrl(name));
  if (res.status === 404) throw new NpmPackageNotFoundError(name);
  if (!res.ok) throw new Error(`npm_registry_error:${res.status}`);
  const doc = (await res.json()) as Record<string, unknown>;
  const resolved = pickVersion(doc);
  const versions = doc.versions as Record<string, Record<string, unknown>> | undefined;
  const versionDoc = versions?.[resolved] ?? doc;
  return metaFromVersionDoc(name, resolved, versionDoc);
}
