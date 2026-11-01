/** Choix d'un contact du téléphone (Contact Picker API : Chrome sur Android ; absente sur iPhone). */
type ContactChoisi = { name?: string[]; tel?: string[] }
type SelecteurContacts = { select: (champs: string[], options: { multiple: boolean }) => Promise<ContactChoisi[]> }

const selecteur = (): SelecteurContacts | null =>
  typeof navigator !== 'undefined' && 'contacts' in navigator ? (navigator as unknown as { contacts: SelecteurContacts }).contacts : null

export const contactsDisponibles = () => selecteur() != null

/** Ouvre le carnet d'adresses ; null si l'utilisateur annule ou si le téléphone ne le permet pas. */
export async function choisirContact(): Promise<{ nom: string; telephone: string } | null> {
  const s = selecteur()
  if (!s) return null
  try {
    const [c] = await s.select(['name', 'tel'], { multiple: false })
    if (!c) return null
    return { nom: (c.name?.[0] ?? '').trim(), telephone: (c.tel?.[0] ?? '').replace(/[^\d+]/g, '') }
  } catch {
    return null
  }
}
