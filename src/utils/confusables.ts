/**
 * Map common Cyrillic/Greek homoglyphs to ASCII before policy regex matching.
 * Complements Unicode NFKC (which does not fold lookalike letters).
 */
const HOMOGLYPH_MAP: Record<number, string> = {
  0x0430: 'a', // а
  0x0435: 'e', // е
  0x043e: 'o', // о
  0x0440: 'p', // р
  0x0441: 'c', // с
  0x0443: 'y', // у
  0x0445: 'x', // х
  0x0456: 'i', // і
  0x03bf: 'o', // ο Greek omicron
  0x03c1: 'p', // ρ
};

export function foldHomoglyphs(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    out += HOMOGLYPH_MAP[code] ?? ch;
  }
  return out;
}
