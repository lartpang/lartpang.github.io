// The site's palette of the week. A seed derived from the ISO week picks a hue family;
// three tones are built from it (light "art" for About, neutral "paper" for Research and
// Code, dark "ink" for Photography). The same seed draws the geometric artwork on About,
// so the artwork and the pages always share one palette.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 864e5 + 1) / 7) };
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
}
const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
function luminance([r, g, b]) {
  const c = [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

// move a text colour's lightness until it reaches the target contrast on its background
function readable(h, s, l, bg, target, step) {
  for (let i = 0; i < 100 && contrast(hslToRgb(h, s, l), bg) < target; i++) l = Math.max(0, Math.min(100, l + step));
  return hex(hslToRgb(h, s, l));
}

// hue families that read as calm and printed-paper-like when desaturated
const FAMILIES = [212, 196, 168, 150, 32, 18, 262, 340];

export function makeTheme(date = new Date()) {
  const { year, week } = isoWeek(date);
  const seed = (year * 100 + week) * 2654435761 >>> 0;
  const r = rng(seed);
  const hue = (FAMILIES[Math.floor(r() * FAMILIES.length)] + (r() - .5) * 16 + 360) % 360;
  const accentHue = (hue + (r() < .5 ? 150 : 200) + (r() - .5) * 20) % 360;

  const tone = (bgL, bgS, dark) => {
    const bg = hslToRgb(hue, bgS, bgL);
    const dir = dark ? 1 : -1;
    return {
      paper: hex(bg),
      raised: hex(hslToRgb(hue, bgS, bgL + (dark ? 4 : 2))),
      ink: readable(hue, dark ? 10 : 28, dark ? 88 : 18, bg, 13, dir),
      soft: readable(hue, dark ? 8 : 12, dark ? 72 : 36, bg, 7, dir),
      faint: readable(hue, dark ? 6 : 8, dark ? 58 : 48, bg, 4.6, dir),
      rule: hex(hslToRgb(hue, dark ? 8 : 16, dark ? bgL + 12 : bgL - 9)),
      line: hex(hslToRgb(hue, dark ? 20 : 34, dark ? 70 : 28)),
      accent: readable(accentHue, dark ? 70 : 62, dark ? 62 : 44, bg, 4.6, dir),
    };
  };

  return {
    week: `${year}-W${String(week).padStart(2, '0')}`,
    seed,
    hue: Math.round(hue),
    accentHue: Math.round(accentHue),
    tones: {
      art: tone(94, 24, false),
      paper: tone(98, 10, false),
      ink: tone(6, 12, true),
    },
  };
}
