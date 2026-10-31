import { useState } from 'react'
import { useDonnees } from '../../data/useDonnees'
import { fichierExcel } from '../../export/exportExcel'
import { aujourdhui, formatDate } from '../../lib/format'
import { Titre } from '../composants/Pastille'

function telecharger(f: File) {
  const url = URL.createObjectURL(f)
  const a = document.createElement('a')
  a.href = url
  a.download = f.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function Export() {
  const d = useDonnees()
  const [etat, setEtat] = useState<'pret' | 'en_cours' | 'fait' | 'erreur'>('pret')
  const derniere = d.reglages[0]?.derniere_sauvegarde

  async function exporter() {
    setEtat('en_cours')
    const ref = aujourdhui()
    try {
      const f = fichierExcel(d, ref)
      if (navigator.canShare?.({ files: [f] })) {
        try {
          await navigator.share({ files: [f], title: f.name })
        } catch (e) {
          if ((e as Error).name === 'AbortError') return setEtat('pret')
          telecharger(f)
        }
      } else telecharger(f)
      await d.enregistrer('reglages', { id: 1, derniere_sauvegarde: ref })
      setEtat('fait')
    } catch {
      setEtat('erreur')
    }
  }

  return (
    <main>
      <Titre genre="export">Export Excel</Titre>
      <div className="carte">
        <p>Crée un classeur Excel avec toutes les données (transactions, paiements, crédits, bandes, ponte, bilan mensuel), à envoyer sur Google Drive, WhatsApp ou par e-mail.</p>
        <p className="discret">Dernière sauvegarde : {derniere ? formatDate(derniere) : 'jamais'}</p>
        <button className="principal" disabled={etat === 'en_cours'} onClick={exporter}>Exporter et partager</button>
        {etat === 'fait' && <p className="ok">Sauvegarde faite ✓</p>}
        {etat === 'erreur' && <p className="erreur">L’export a échoué. Réessayez.</p>}
      </div>
    </main>
  )
}
