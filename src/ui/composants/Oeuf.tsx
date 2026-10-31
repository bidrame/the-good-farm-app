import { OEUF_CORPS, OEUF_DEFS } from '../oeufSvg'

/** Le petit œuf de The Good Farm (mascotte). */
export function Oeuf({ taille = 40 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille * 1.2} viewBox="120 60 272 390" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: `<defs>${OEUF_DEFS}</defs>${OEUF_CORPS}` }} />
  )
}
