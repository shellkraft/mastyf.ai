import { z } from 'zod';
import { isValidNpmPackageName } from './npm-package-name';

export const packageNameSchema = z
  .string()
  .min(1)
  .max(214)
  .refine(isValidNpmPackageName, { message: 'Invalid npm package name' });

export const badgeQuerySchema = z.object({
  style: z.enum(['github', 'flat', 'flat-square']).optional(),
  format: z.enum(['json', 'svg']).optional(),
});

export const policyPutSchema = z.object({
  yaml: z.string().min(10).max(512_000).optional(),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.string().min(1).max(64)).max(20).optional(),
});

export const deepScanParamsSchema = z.object({
  package: z.array(z.string()).min(1).max(10),
});

export function parseJsonBody<T>(schema: z.ZodType<T>, body: unknown):
  | { ok: true; data: T }
  | { ok: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => i.message).join('; ') };
  }
  return { ok: true, data: result.data };
}
