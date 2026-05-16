/**
 * Payload Normalization Layer — sanitizes inputs before policy evaluation.
 *
 * Closes bypass class: URL-encoded, hex-encoded, unicode-homoglyph,
 * and shell-escape-obfuscated payloads that evade regex pattern matching.
 *
 * Architecture: normalize → denormalize → sanitize → evaluate
 */
import { Logger } from './logger.js';
import { foldHomoglyphs } from './confusables.js';

export interface NormalizationResult {
  /** The fully normalized string ready for policy evaluation */
  normalized: string;
  /** Whether any normalization was applied */
  wasModified: boolean;
  /** What transformations were applied */
  transformations: string[];
  /** The original raw input */
  original: string;
}

/**
 * PayloadNormalizer applies multi-stage normalization to defeat
 * common evasion techniques targeting regex-based policy engines.
 */
export class PayloadNormalizer {
  private readonly maxDepth: number;
  private readonly maxLength: number;

  constructor(maxDepth = 5, maxLength = 1_000_000) {
    this.maxDepth = maxDepth;
    this.maxLength = maxLength;
  }

  /**
   * Full normalization pipeline for policy evaluation input.
   */
  normalize(input: string): NormalizationResult {
    const transformations: string[] = [];
    let current = input;
    let depth = 0;

    // ── Step 0: Truncate oversized inputs (memory safety) ──
    if (current.length > this.maxLength) {
      current = current.slice(0, this.maxLength);
      transformations.push('truncated');
    }

    // ── Step 1: Homoglyph fold (Cyrillic/Greek → ASCII) then NFKC ──
    const homoglyphFolded = foldHomoglyphs(current);
    if (homoglyphFolded !== current) {
      transformations.push('homoglyph-fold');
      current = homoglyphFolded;
    }
    const unicodeNormalized = current.normalize('NFKC');
    if (unicodeNormalized !== current) {
      transformations.push('unicode-nfkc');
      current = unicodeNormalized;
    }

    // ── Step 2: Iterative decode loop (URL, hex, HTML entities) ──
    while (depth < this.maxDepth) {
      const before = current;

      // URL decode (handles %20, %00 null bytes, %2F slashes)
      current = this.urlDecode(current);

      // Hex escape decode (\x41, \x00, \x2F)
      current = this.decodeHexEscapes(current);

      // Unicode escape decode (\u0041, \U00000041)
      current = this.decodeUnicodeEscapes(current);

      // HTML entity decode (<, &#60;, &#x3C;)
      current = this.decodeHtmlEntities(current);

      // Double-backslash unwrap (\\. → .)
      current = this.unwrapDoubleEscapes(current);

      if (current === before) break;
      depth++;
    }

    if (current !== unicodeNormalized) {
      transformations.push('decode-loop');
    }

    // ── Step 3: Shell normalization ──
    const shellNormalized = this.shellNormalize(current);
    if (shellNormalized !== current) {
      transformations.push('shell-normalize');
      current = shellNormalized;
    }

    // ── Step 4: Whitespace normalization (collapse runs) ──
    const whitespaceNormalized = current.replace(/\s+/g, ' ').trim();
    if (whitespaceNormalized !== current) {
      transformations.push('whitespace');
      current = whitespaceNormalized;
    }

    return {
      normalized: current,
      wasModified: transformations.length > 0,
      transformations,
      original: input,
    };
  }

  /**
   * URL decode: %XX → character, handles malformed sequences.
   */
  private urlDecode(input: string): string {
    try {
      // Only decode percent-encoded sequences; do NOT treat + as space (form-encoding, not applicable to JSON-RPC)
      return input.replace(/%([0-9A-Fa-f]{2})/g, (_match, hex) => {
        try { return String.fromCharCode(parseInt(hex, 16)); } catch { return _match; }
      });
    } catch {
      // Gracefully handle malformed % sequences: replace only valid ones
      return input.replace(/%([0-9A-Fa-f]{2})/g, (_match, hex) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch {
          return _match;
        }
      });
    }
  }

  /**
   * Decode hex escapes: \x41 → 'A', \x00 → null byte detection.
   */
  private decodeHexEscapes(input: string): string {
    return input.replace(/\\x([0-9A-Fa-f]{2})/g, (_match, hex) => {
      const code = parseInt(hex, 16);
      // Preserve null byte as marker for detection
      if (code === 0) return '\0';
      return String.fromCharCode(code);
    });
  }

  /**
   * Decode unicode escapes: \u0041 → 'A', \U00000041 → 'A'.
   */
  private decodeUnicodeEscapes(input: string): string {
    return input
      .replace(/\\u([0-9A-Fa-f]{4})/g, (_match, hex) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch {
          return _match;
        }
      })
      .replace(/\\U([0-9A-Fa-f]{8})/g, (_match, hex) => {
        try {
          const code = parseInt(hex, 16);
          if (code > 0x10ffff) return _match; // Invalid unicode
          return String.fromCodePoint(code);
        } catch {
          return _match;
        }
      });
  }

  /**
   * Decode HTML entities: < -> <, &#60; -> <, &#x3C; -> <.
   * Entity map built at runtime to avoid source-level entity decoding issues.
   */
  private static htmlEntityMap: Array<[RegExp, string]> | null = null;

  private static getHtmlEntityMap(): Array<[RegExp, string]> {
    if (PayloadNormalizer.htmlEntityMap) return PayloadNormalizer.htmlEntityMap;

    const a = String.fromCharCode(38); // ampersand char
    const pairs: Array<[string, string]> = [
      [a + 'lt;', '<'],
      [a + 'gt;', '>'],
      [a + 'amp;', a],
      [a + 'quot;', '"'],
      [a + '#39;', "'"],
      [a + 'apos;', "'"],
      [a + 'sol;', '/'],
      [a + 'bsol;', '\\'],
      [a + 'colon;', ':'],
      [a + 'semi;', ';'],
      [a + 'verbar;', '|'],
      [a + 'dollar;', '$'],
      [a + 'lpar;', '('],
      [a + 'rpar;', ')'],
      [a + 'lcub;', '{'],
      [a + 'rcub;', '}'],
      [a + 'lbrack;', '['],
      [a + 'rbrack;', ']'],
    ];

    PayloadNormalizer.htmlEntityMap = pairs.map(([entity, ch]) => {
      const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return [new RegExp(escaped, 'g'), ch];
    });

    return PayloadNormalizer.htmlEntityMap;
  }

  private decodeHtmlEntities(input: string): string {
    let result = input;
    // Named entities
    for (const [regex, ch] of PayloadNormalizer.getHtmlEntityMap()) {
      result = result.replace(regex, ch);
    }
    // Numeric decimal entities: &#60;
    result = result.replace(/&#(\d+);/g, (_match, dec) => {
      const code = parseInt(dec, 10);
      return (code > 0 && code < 65536) ? String.fromCharCode(code) : _match;
    });
    // Numeric hex entities: &#x3C;
    result = result.replace(/&#x([0-9A-Fa-f]+);/g, (_match, hex) => {
      const code = parseInt(hex, 16);
      return (code > 0 && code < 65536) ? String.fromCharCode(code) : _match;
    });
    return result;
  }

  /**
   * Unwrap double escapes: \\. → literal character.
   */
  private unwrapDoubleEscapes(input: string): string {
    return input.replace(/\\(.)/g, (_match, char) => {
      // Only unwrap if the backslash is escaping a non-special char
      if ('\\$`"\''.includes(char)) return _match;
      return char;
    });
  }

  /**
   * Shell normalize: collapse common shell obfuscation patterns.
   *
   * - $'cmd' → cmd (ANSI-C quoting)
   * - "c"m"d" → cmd (quote splitting)
   * - ''cmd'' → cmd (empty quote pairs)
   * - c\md → cmd (backslash escapes)
   */
  private shellNormalize(input: string): string {
    let result = input;

    // ANSI-C quoting: $'command' → command
    result = result.replace(/\$'([^']*)'/g, '$1');

    // Quote splitting: "a""b" → ab, 'a''b' → ab
    result = result.replace(/["']\s*["']/g, '');

    // Shell backslash escapes on non-special chars
    result = result.replace(/\\([^\\$`"'|&;><~#%{}()\[\]])/g, '$1');

    // Null byte detection (normalized → mark as NUL for policy patterns)
    result = result.replace(/\0/g, '\\0');

    return result;
  }

  /**
   * Specifically normalize a JSON string value (tool argument).
   * Handles nested JSON structures recursively.
   */
  normalizeJsonValue(value: unknown, depth = 0): unknown {
    if (depth > 10) return value; // Recursion guard

    if (typeof value === 'string') {
      return this.normalize(value).normalized;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeJsonValue(item, depth + 1));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.normalizeJsonValue(val, depth + 1);
      }
      return result;
    }

    return value;
  }
}

/** Singleton instance for policy engine integration */
let defaultInstance: PayloadNormalizer | null = null;

export function getNormalizer(): PayloadNormalizer {
  if (!defaultInstance) {
    defaultInstance = new PayloadNormalizer();
  }
  return defaultInstance;
}