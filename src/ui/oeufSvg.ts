/** Dessin de l'œuf The Good Farm (repère 512×512), partagé par l'appli et le générateur d'icônes. */
export const OEUF_DEFS = `
  <radialGradient id="tgf-coquille" cx="0.38" cy="0.32" r="0.8">
    <stop offset="0" stop-color="#FFFBF0"/>
    <stop offset="0.55" stop-color="#FBEBC8"/>
    <stop offset="1" stop-color="#EBC88A"/>
  </radialGradient>`

export const OEUF_CORPS = `
  <ellipse cx="256" cy="436" rx="92" ry="14" fill="#000" opacity="0.14"/>
  <path d="M256 130 C 306 130 370 224 372 306 C 374 380 322 430 256 430 C 190 430 138 380 140 306 C 142 224 206 130 256 130 Z" fill="url(#tgf-coquille)"/>
  <path d="M256 130 C 306 130 370 224 372 306 C 374 380 322 430 256 430 C 190 430 138 380 140 306 C 142 224 206 130 256 130 Z" fill="none" stroke="#D9AE63" stroke-width="4" opacity="0.55"/>
  <ellipse cx="212" cy="222" rx="24" ry="46" transform="rotate(-22 212 222)" fill="#FFFFFF" opacity="0.75"/>
  <path d="M256 136 C 256 120 258 108 262 96" fill="none" stroke="#5E9E2C" stroke-width="9" stroke-linecap="round"/>
  <path d="M260 108 C 238 82 204 82 190 94 C 206 116 236 122 260 108 Z" fill="#8FCB5B"/>
  <path d="M262 100 C 278 70 316 62 334 72 C 322 100 290 112 262 100 Z" fill="#5E9E2C"/>`

/** Icône d'appli : fond vert arrondi (ou plein pour l'icône « maskable »), œuf au centre. */
export function svgIcone({ maskable = false } = {}): string {
  const fond = maskable
    ? '<rect width="512" height="512" fill="#2F5D0F"/>'
    : '<rect width="512" height="512" rx="112" fill="#2F5D0F"/>'
  const echelle = maskable ? 'translate(51.2 51.2) scale(0.8)' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${OEUF_DEFS}</defs>${fond}<g transform="${echelle}">${OEUF_CORPS}</g></svg>`
}
