/** Luminancia relativa WCAG de un color "#rrggbb". */
export function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

/** Texto blanco o negro encima del acento: el que dé más contraste. */
export function textoSobre(hex: string): "#ffffff" | "#000000" {
  return contraste(hex, "#ffffff") >= contraste(hex, "#000000") ? "#ffffff" : "#000000";
}
