import type { ReactNode } from 'react'
import type { Icon } from '@tabler/icons-react'
import { ICONES, TAILLE, TEINTE, TRAIT, type Genre } from '../icones'

/** Icône dans une pastille de couleur douce (fond clair, icône foncée). Décorative : le texte à côté porte le sens. */
export function Pastille({ genre, petite = false }: { genre: Genre; petite?: boolean }) {
  const Icone = ICONES[genre]
  return (
    <span className={`pastille teinte-${TEINTE[genre]}${petite ? ' petite' : ''}`} aria-hidden="true">
      <Icone size={petite ? TAILLE.ligne - 4 : TAILLE.carte - 2} stroke={TRAIT} />
    </span>
  )
}

/** Titre de page précédé de sa pastille. */
export function Titre({ genre, children }: { genre: Genre; children: ReactNode }) {
  return (
    <h1 className="titre">
      <Pastille genre={genre} />
      <span>{children}</span>
    </h1>
  )
}

/** Icône dans un bouton, alignée sur le libellé. */
export function IconeBouton({ Icone }: { Icone: Icon }) {
  return <Icone size={TAILLE.bouton} stroke={2} aria-hidden="true" />
}

/** État vide illustré : une icône, une phrase, et éventuellement une action. */
export function EtatVide({ genre, message, children }: { genre: Genre; message: string; children?: ReactNode }) {
  return (
    <div className="etat-vide">
      <Pastille genre={genre} />
      <p>{message}</p>
      {children}
    </div>
  )
}
