/**
 * CSS color parsing and conversion to sRGB hex, for importing third-party themes (tweakcn).
 * Supports hex (#rgb, #rgba, #rrggbb, #rrggbbaa), hsl()/hsla() (space or comma syntax),
 * rgb()/rgba() and oklch(). Out-of-gamut oklch colors are clamped per channel to [0, 1]
 * after conversion. Pure and deterministic.
 */

export interface Rgba {
  /** sRGB channels in [0, 1]. */
  r: number;
  g: number;
  b: number;
  /** Alpha in [0, 1]. */
  a: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function parseNumber(token: string, percentScale: number): number {
  const trimmed = token.trim();
  if (trimmed.endsWith("%")) return (Number.parseFloat(trimmed) / 100) * percentScale;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) throw new Error(`Invalid number "${token}"`);
  return value;
}

function parseHue(token: string): number {
  const trimmed = token.trim();
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) throw new Error(`Invalid hue "${token}"`);
  if (trimmed.endsWith("turn")) return value * 360;
  if (trimmed.endsWith("rad")) return (value * 180) / Math.PI;
  return value;
}

/** Splits "a b c / d" or "a, b, c, d" into channel tokens and an optional alpha token. */
function splitArgs(inner: string): { channels: string[]; alpha?: string } {
  const [main, alphaPart] = inner.split("/");
  const channels = main!.trim().split(/[\s,]+/).filter(Boolean);
  if (alphaPart !== undefined) return { channels, alpha: alphaPart.trim() };
  if (channels.length === 4) return { channels: channels.slice(0, 3), alpha: channels[3] };
  return { channels };
}

function parseAlpha(token: string | undefined): number {
  return token === undefined ? 1 : clamp01(parseNumber(token, 1));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function linearToSrgb(value: number): number {
  const abs = Math.abs(value);
  const encoded = abs <= 0.0031308 ? 12.92 * abs : 1.055 * abs ** (1 / 2.4) - 0.055;
  return Math.sign(value) * encoded;
}

/** OKLCH (L in 0..1, C, H in degrees) to gamma-encoded sRGB, unclamped. */
export function oklchToSrgb(l: number, c: number, h: number): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(bl)];
}

export function parseCssColor(input: string): Rgba {
  const value = input.trim().toLowerCase();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(hex)) throw new Error(`Invalid hex color "${input}"`);
    const full = hex.length <= 4 ? [...hex].map((char) => char + char).join("") : hex;
    const channel = (index: number) => Number.parseInt(full.slice(index, index + 2), 16) / 255;
    return { r: channel(0), g: channel(2), b: channel(4), a: full.length === 8 ? channel(6) : 1 };
  }
  const match = /^([a-z]+)\((.*)\)$/.exec(value);
  if (!match) throw new Error(`Unsupported color "${input}"`);
  const [, fn, inner] = match;
  const { channels, alpha } = splitArgs(inner!);
  if (channels.length !== 3) throw new Error(`Expected three channels in "${input}"`);
  const a = parseAlpha(alpha);
  if (fn === "hsl" || fn === "hsla") {
    const [r, g, b] = hslToRgb(parseHue(channels[0]!), clamp01(parseNumber(channels[1]!, 1) / (channels[1]!.endsWith("%") ? 1 : 100)), clamp01(parseNumber(channels[2]!, 1) / (channels[2]!.endsWith("%") ? 1 : 100)));
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a };
  }
  if (fn === "rgb" || fn === "rgba") {
    const channel = (token: string) => clamp01(token.endsWith("%") ? parseNumber(token, 1) : parseNumber(token, 1) / 255);
    return { r: channel(channels[0]!), g: channel(channels[1]!), b: channel(channels[2]!), a };
  }
  if (fn === "oklch") {
    const l = parseNumber(channels[0]!, 1);
    const c = channels[1]!.endsWith("%") ? parseNumber(channels[1]!, 0.4) : parseNumber(channels[1]!, 1);
    const h = channels[2] === "none" ? 0 : parseHue(channels[2]!);
    const [r, g, b] = oklchToSrgb(l, Math.max(0, c), h);
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a };
  }
  throw new Error(`Unsupported color function "${fn}" in "${input}"`);
}

/** Composites a translucent color over an opaque backdrop. */
export function compositeOver(color: Rgba, backdrop: Rgba): Rgba {
  const mix = (top: number, bottom: number) => top * color.a + bottom * (1 - color.a);
  return { r: mix(color.r, backdrop.r), g: mix(color.g, backdrop.g), b: mix(color.b, backdrop.b), a: 1 };
}

export function rgbaToHex(color: Rgba): string {
  const channel = (value: number) => Math.round(clamp01(value) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

/** Opaque sRGB hex for a CSS color; translucent colors are composited over `backdrop` (default white). */
export function cssColorToHex(input: string, backdrop = "#FFFFFF"): string {
  const color = parseCssColor(input);
  return rgbaToHex(color.a < 1 ? compositeOver(color, parseCssColor(backdrop)) : color);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseCssColor(hex);
  const linear = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2.x contrast ratio between two opaque colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}
