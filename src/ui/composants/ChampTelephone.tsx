import { useState } from 'react'
import { IconAddressBook } from '@tabler/icons-react'
import { useDonnees } from '../../data/useDonnees'
import type { Client } from '../../lib/types'
import { choisirContact, contactsDisponibles } from '../../lib/contacts'

/** Champ téléphone, avec « Choisir dans mes contacts » quand le téléphone le permet. */
export function ChampTelephone({ valeur, onChange, onBlur, onContact }: {
  valeur: string
  onChange: (tel: string) => void
  onBlur?: () => void
  /** Reçoit le contact entier (nom compris) ; sinon seul le numéro est repris. */
  onContact?: (c: { nom: string; telephone: string }) => void
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ marginBottom: 6 }}>
        Téléphone
        <input inputMode="tel" autoComplete="tel" value={valeur} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder="77 123 45 67" />
      </label>
      {contactsDisponibles() && (
        <button type="button" style={{ width: '100%' }} onClick={async () => {
          const c = await choisirContact()
          if (!c) return
          if (onContact) onContact(c)
          else onChange(c.telephone)
        }}>
          <IconAddressBook size={20} stroke={2} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Choisir dans mes contacts
        </button>
      )}
    </div>
  )
}

/** Téléphone d'une fiche client ou fournisseur : enregistré en quittant le champ ou dès qu'un contact est choisi. */
export function TelephoneFiche({ c }: { c: Client }) {
  const { enregistrer } = useDonnees()
  const [tel, setTel] = useState(c.telephone ?? '')
  const sauver = (v: string) => { if (v.trim() !== (c.telephone ?? '')) void enregistrer('clients', { ...c, telephone: v.trim() || null }) }
  return (
    <>
      <ChampTelephone valeur={tel} onChange={setTel} onBlur={() => sauver(tel)} onContact={(x) => { setTel(x.telephone); sauver(x.telephone) }} />
      {c.telephone && <a href={`tel:${c.telephone.replace(/[^\d+]/g, '')}`} className="bouton-lien" style={{ marginBottom: 12 }}>Appeler {c.nom}</a>}
    </>
  )
}
