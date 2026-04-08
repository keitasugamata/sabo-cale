// 任意の色を、白文字が読めるダークトーンに変換する
// HSL の Lightness を上限値以下にキャップする方式
export function toChipColor(color, maxLightness = 0.38) {
  if (!color) return '#5b21b6';

  let r, g, b;
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    r = parseInt(hex.slice(0, 2), 16) / 255;
    g = parseInt(hex.slice(2, 4), 16) / 255;
    b = parseInt(hex.slice(4, 6), 16) / 255;
  } else if (color.startsWith('rgb')) {
    const m = color.match(/[\d.]+/g);
    if (!m) return color;
    r = parseFloat(m[0]) / 255;
    g = parseFloat(m[1]) / 255;
    b = parseFloat(m[2]) / 255;
  } else {
    return color;
  }

  // RGB → HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  // 既に十分暗ければそのまま
  if (l <= maxLightness) return color;

  let h, s;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // 明度を上限まで下げる + 彩度を少しだけブースト
  const newL = maxLightness;
  const newS = Math.min(s * 1.1, 1);

  // HSL → RGB
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
  const p = 2 * newL - q;
  const r2 = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g2 = Math.round(hue2rgb(p, q, h) * 255);
  const b2 = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `rgb(${r2}, ${g2}, ${b2})`;
}
