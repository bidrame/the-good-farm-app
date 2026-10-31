/** Les graphiques SVG ne comprennent pas var(--x) dans leurs attributs : on lit la valeur réelle du thème. */
export function couleur(variable: string, secours = '#3b6d11'): string {
  if (typeof document === 'undefined') return secours
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || secours
}
