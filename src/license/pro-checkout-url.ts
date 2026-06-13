/** Live Lemon Squeezy checkout — safe to commit (public product URL). */
export const DEFAULT_PRO_CHECKOUT_URL =
  'https://mastyff-ai.lemonsqueezy.com/checkout/buy/f725abfe-93c0-4bd7-8add-d15af13958fb';

export function resolveProCheckoutUrl(): string {
  const fromEnv =
    process.env['MASTYFF_AI_PRO_CHECKOUT_URL']?.trim()
    || process.env['NEXT_PUBLIC_PRO_CHECKOUT_URL']?.trim();
  return fromEnv || DEFAULT_PRO_CHECKOUT_URL;
}
