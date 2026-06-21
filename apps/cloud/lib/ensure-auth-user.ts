import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { users } from './db/schema';

/** Insert users row if missing — required before org provisioning (FK). */
export async function ensureAuthUser(input: {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): Promise<void> {
  const email = input.email?.trim() || `${input.id}@oauth.mastyf.ai.local`;
  const existing = await getDb().query.users.findFirst({
    where: eq(users.id, input.id),
  });
  if (existing) return;

  await getDb()
    .insert(users)
    .values({
      id: input.id,
      email,
      name: input.name ?? null,
      image: input.image ?? null,
    })
    .onConflictDoNothing();
}
