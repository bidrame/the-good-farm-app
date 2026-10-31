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

/*
 * Icône d'appli « standard des stores » (Apple HIG, Material adaptive icons) :
 * un seul glyphe simple et lisible (œuf + pousse), fond plein en dégradé, aucun texte,
 * pas de coins arrondis ni de transparence pour iOS (le système applique son masque),
 * glyphe dans la zone sûre de 66 % pour les masques Android, variante monochrome pour les icônes à thème.
 */
const ICONE_DEFS = `
  <linearGradient id="ic-fond" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4E8F20"/>
    <stop offset="1" stop-color="#1E4108"/>
  </linearGradient>
  <radialGradient id="ic-halo" cx="0.5" cy="0.48" r="0.5">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.18"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="ic-coquille" x1="0.25" y1="0.1" x2="0.8" y2="0.95">
    <stop offset="0" stop-color="#FFFDF7"/>
    <stop offset="0.6" stop-color="#FBEBC6"/>
    <stop offset="1" stop-color="#EFCB86"/>
  </linearGradient>
  <linearGradient id="ic-feuille" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#F2B705"/>
    <stop offset="1" stop-color="#FFD54A"/>
  </linearGradient>
  <filter id="ic-ombre" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0B1E02" flood-opacity="0.35"/>
  </filter>`

/** Glyphe centré dans le repère 512 : œuf plein et pousse jaune (couleur « œuf » de la marque). */
const GLYPHE = (coquille: string, feuille: string, ombre: boolean) => `
  <g${ombre ? ' filter="url(#ic-ombre)"' : ''}>
    <path d="M256 152 C 326 152 374 248 374 320 C 374 390 322 432 256 432 C 190 432 138 390 138 320 C 138 248 186 152 256 152 Z" fill="${coquille}"/>
  </g>
  <path d="M256 150 C 252 132 254 116 262 104" fill="none" stroke="${feuille}" stroke-width="10" stroke-linecap="round"/>
  <path d="M262 106 C 270 82 300 66 330 70 C 324 98 296 116 262 106 Z" fill="${feuille}"/>
  <path d="M254 118 C 240 100 214 94 196 102 C 208 124 234 128 254 118 Z" fill="${feuille}" opacity="0.85"/>`

const REFLET = `<path d="M196 238 C 204 210 222 190 240 182 C 230 206 222 234 220 266 C 206 260 194 252 196 238 Z" fill="#FFFFFF" opacity="0.75"/>`

export type VarianteIcone = 'carree' | 'arrondie' | 'adaptative' | 'monochrome'

export function svgIconeStore(variante: VarianteIcone): string {
  if (variante === 'monochrome') {
    // Silhouette unie sur fond transparent : Android la recolore selon le thème.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(35.84 35.84) scale(0.86)">${GLYPHE('#FFFFFF', '#FFFFFF', false)}</g></svg>`
  }
  const fond = `<rect width="512" height="512"${variante === 'arrondie' ? ' rx="115"' : ''} fill="url(#ic-fond)"/><rect width="512" height="512"${variante === 'arrondie' ? ' rx="115"' : ''} fill="url(#ic-halo)"/>`
  // Adaptative : le glyphe tient dans le cercle sûr central (≈ 66 % du côté).
  const echelle = variante === 'adaptative' ? 'translate(35.84 35.84) scale(0.86)' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${ICONE_DEFS}</defs>${fond}<g transform="${echelle}">${GLYPHE('url(#ic-coquille)', 'url(#ic-feuille)', true)}${REFLET}</g></svg>`
}
