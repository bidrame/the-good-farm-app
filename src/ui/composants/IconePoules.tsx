import { forwardRef, useId, type SVGProps } from 'react'
import type { Icon } from '@tabler/icons-react'

// Poule de profil tournée vers la droite (boîte 0..11) : queue en éventail, crête, bec, barbillon. Retournée à l'affichage.
const POULE = 'M3 5.2 L1.2 1.6 L4.6 3.1 Q5.6 3.4 6.6 3.3 Q6.9 1.5 8.2 1.3 L8.6 0.5 L9.4 1.5 Q9.9 1.7 10 2.1 L11 2.6 L10 3 Q10 3.6 9.6 3.9 Q10.6 5.6 9.6 7.4 Q8 9.3 5.6 9.1 Q2.8 8.8 2.5 6.6 Q2.5 5.8 3 5.2 Z'
const PATTES = 'M5.6 9.1 V10.6 M7.6 8.7 V10.6'
const LARGEUR = 11

/** Du premier plan vers le fond : une poule entière, puis deux autres dont seuls la tête et le dos dépassent. */
const POULES: [x: number, y: number, echelle: number][] = [[1.3, 9.7, 1.3], [6.6, 5.5, 1.18], [11.6, 1.6, 1.08]]
const transformation = ([x, y, s]: (typeof POULES)[number]) => `translate(${x + LARGEUR * s} ${y}) scale(${-s} ${s})`

type Props = Omit<SVGProps<SVGSVGElement>, 'stroke'> & { size?: number | string; stroke?: number | string; title?: string }

/** Icône des bandes : un petit troupeau de poules tournées vers la gauche, au trait comme les icônes Tabler. */
export const IconePoules = forwardRef<SVGSVGElement, Props>(function IconePoules({ size = 24, stroke = 2, title, ...props }, ref) {
  const id = `poules${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const trait = Number(stroke) * 0.75
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      {title && <title>{title}</title>}
      {/* Chaque poule est cachée par celles qui sont devant elle (leur silhouette, élargie d'un liseré). */}
      {POULES.slice(1).map((_, i) => (
        <mask key={i} id={`${id}-${i + 1}`}>
          <rect x="-2" y="-2" width="28" height="28" fill="white" />
          {POULES.slice(0, i + 1).map((p) => (
            <path key={p.join()} d={POULE} transform={transformation(p)} fill="black" stroke="black" strokeWidth={(trait * 2.6) / p[2]} />
          ))}
        </mask>
      ))}
      {[...POULES].reverse().map((p) => {
        const rang = POULES.indexOf(p)
        return (
          <g key={p.join()} mask={rang ? `url(#${id}-${rang})` : undefined}>
            <g transform={transformation(p)} strokeWidth={trait / p[2]}>
              <path d={POULE} />
              <path d={PATTES} />
              <circle cx="8.8" cy="2.3" r="0.42" fill="currentColor" stroke="none" />
            </g>
          </g>
        )
      })}
    </svg>
  )
}) as unknown as Icon
