import { useEffect, useRef, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { useDonnees } from '../../data/useDonnees'
import { dernierPrix } from '../../lib/calculs/credits'
import { estProduitOeufs, OEUFS_PAR_PLATEAU } from '../../lib/calculs/oeufs'
import { CALIBRES, cle as cleDe, NOM_CALIBRE, nomCle, ORDRE_CLES, type CleCalibre } from '../../lib/calculs/calibres'
import { resteParCalibre, totalCharge } from '../../lib/calculs/ramassage'
import { formatDate, formatFCFA } from '../../lib/format'
import type { Calibre, Ramassage } from '../../lib/types'
import { ChampClient } from './ChampClient'
import { ChampMontant } from './communs'
import { BoutonAjout } from './Pastille'

type Paiement = 'credit' | 'paye' | 'partie'
type Ligne = { cle: string; client_id: string | null; calibre: Calibre | null; plateaux: number | null; prix: number | null; paiement: Paiement; paye: number | null }

const nouvelleLigne = (p: Partial<Ligne> = {}): Ligne => ({ cle: crypto.randomUUID(), client_id: null, calibre: null, plateaux: null, prix: null, paiement: 'credit', paye: null, ...p })
/** Calibre proposé pour une nouvelle ligne : le premier calibre trié qui a encore des plateaux (rien si non trié). */
const premierCalibreLibre = (restes: Partial<Record<CleCalibre, number>>): Calibre | null =>
  CALIBRES.find((c) => (restes[c] ?? 0) > 0) ?? null
const pluriel = (n: number) => `${n} plateau${Math.abs(n) > 1 ? 'x' : ''}`

/**
 * Répartition du chargement entre les clients : chaque quantité saisie fait baisser le reste à répartir,
 * puis une vente est créée par client, datée du jour de la livraison.
 */
export function Repartition({ r, precedent, onFini }: { r: Ramassage; precedent: Ramassage | null; onFini: () => void }) {
  const { clients, produits, transactions, enregistrer } = useDonnees()
  const [lignes, setLignes] = useState<Ligne[]>(() => [nouvelleLigne({ calibre: premierCalibreLibre(resteParCalibre(r)) })])
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const formulaire = useRef<HTMLFormElement>(null)
  // Le formulaire s'ouvre plus bas dans la page : on l'amène sous les yeux.
  useEffect(() => { formulaire.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }, [])
  const oeufs = produits.find((p) => p.type === 'vente' && p.actif && !p.supprime_le && estProduitOeufs(p))
  /** Dernier prix de ce client pour ce calibre, sinon son dernier prix d'œufs. */
  function prixHabituel(clientId: string, calibre: Calibre | null): number | null {
    if (!oeufs) return null
    const memeCalibre = !calibre ? undefined : transactions
      .filter((t) => !t.supprime_le && t.client_id === clientId && t.produit_id === oeufs.id && t.calibre === calibre)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    return memeCalibre?.prix_unitaire ?? dernierPrix(transactions, clientId, oeufs.id, OEUFS_PAR_PLATEAU)
  }

  const dispos = resteParCalibre(r)
  const cles = ORDRE_CLES.filter((k) => dispos[k] != null)
  const plusieurs = cles.length > 1
  // Chargement trié : on ne vend que les calibres chargés. Sinon (non classés), tous les calibres se vendent sur le même stock.
  const proposables = cles.includes('autre') ? CALIBRES : CALIBRES.filter((c) => cles.includes(c))
  /** Sur quel reste se prend une ligne : son calibre s'il a été chargé à part, sinon les non classés. */
  const stockDe = (c: Calibre | null): CleCalibre => (cles.includes(cleDe(c)) ? cleDe(c) : 'autre')
  const resteDe = (k: CleCalibre) => (dispos[k] ?? 0) - lignes.filter((l) => stockDe(l.calibre) === k).reduce((s, l) => s + (l.plateaux ?? 0), 0)
  const disponibles = cles.reduce((s, k) => s + (dispos[k] ?? 0), 0)
  const reste = cles.reduce((s, k) => s + resteDe(k), 0)
  const tropQuelquePart = cles.some((k) => resteDe(k) < 0)
  const maj = (cle: string, p: Partial<Ligne>) => setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, ...p } : l)))

  function commeLaDerniereFois() {
    const avant = precedent?.repartition ?? []
    setLignes(avant.length
      ? avant.map((l) => {
        const c = l.calibre && proposables.includes(l.calibre) ? l.calibre : null
        return nouvelleLigne({ client_id: l.client_id, calibre: c, plateaux: l.plateaux, prix: prixHabituel(l.client_id, c) ?? l.prix })
      })
      : [nouvelleLigne()])
  }

  async function valider() {
    const pleines = lignes.filter((l) => l.client_id || l.plateaux)
    if (!oeufs) return setErreur('Aucun produit « œufs » vendu au plateau dans les réglages.')
    if (!pleines.length) return setErreur('Ajoutez au moins un client.')
    if (pleines.some((l) => !l.client_id || !l.plateaux || !l.prix)) return setErreur('Chaque ligne a besoin d’un client, d’un nombre de plateaux et d’un prix.')
    if (pleines.some((l) => !l.calibre)) return setErreur('Choisissez le calibre vendu à chaque client.')
    if (tropQuelquePart) return setErreur('Vous répartissez plus de plateaux que le chargement pour un calibre.')
    const montant = (l: Ligne) => (l.plateaux ?? 0) * (l.prix ?? 0)
    if (pleines.some((l) => l.paiement === 'partie' && (l.paye == null || l.paye > montant(l)))) return setErreur('Indiquez le montant payé (pas plus que le total).')
    setErreur(null)
    setEnCours(true)
    const nouvelles = []
    for (const l of pleines) {
      const id = crypto.randomUUID()
      await enregistrer('transactions', {
        id, date: r.date, type: 'vente', client_id: l.client_id, produit_id: oeufs.id, quantite: l.plateaux, prix_unitaire: l.prix,
        oeufs_par_unite: OEUFS_PAR_PLATEAU, calibre: l.calibre, montant: montant(l),
        montant_paye: l.paiement === 'paye' ? montant(l) : l.paiement === 'partie' ? l.paye : 0,
        observation: `Livraison du ${formatDate(r.date)}`,
      })
      nouvelles.push({ client_id: l.client_id!, calibre: l.calibre, plateaux: l.plateaux!, prix: l.prix!, transaction_id: id })
    }
    await enregistrer('ramassages', { ...r, repartition: [...(r.repartition ?? []), ...nouvelles] })
    setEnCours(false)
    onFini()
  }

  return (
    <form ref={formulaire} aria-label="Répartition entre les clients" className="carte" onSubmit={(e) => { e.preventDefault(); void valider() }}>
      <h2 style={{ marginTop: 0 }}>2. Répartition de la livraison du {formatDate(r.date)}</h2>
      <div className={`compteur-reste ${reste === 0 && !tropQuelquePart ? 'ok' : tropQuelquePart ? 'trop' : ''}`} role="status" aria-label="Reste à répartir">
        <span>{tropQuelquePart ? 'Trop réparti' : reste === 0 ? 'Tout est réparti ✓' : 'Reste à répartir'}</span>
        <strong>{reste === 0 && !tropQuelquePart ? pluriel(disponibles) : pluriel(Math.abs(reste))}</strong>
        <span className="discret">sur {pluriel(Math.round(totalCharge(r) / OEUFS_PAR_PLATEAU))} chargés{disponibles !== Math.round(totalCharge(r) / OEUFS_PAR_PLATEAU) ? `, dont ${pluriel(disponibles)} encore libres` : ''}</span>
        {plusieurs && (
          <span className="restes-calibres">
            {cles.map((k) => (
              <span key={k} className={resteDe(k) < 0 ? 'mauvais' : resteDe(k) === 0 ? 'ok' : ''} aria-label={`Reste ${nomCle(k)}`}>
                {nomCle(k)} <strong>{resteDe(k)}</strong>
              </span>
            ))}
          </span>
        )}
      </div>
      {precedent?.repartition?.length ? <button type="button" style={{ width: '100%', marginBottom: 10 }} onClick={commeLaDerniereFois}>Comme la dernière fois</button> : null}

      {lignes.map((l, i) => {
        const stock = stockDe(l.calibre)
        const avant = (dispos[stock] ?? 0) - lignes.slice(0, i).filter((x) => stockDe(x.calibre) === stock).reduce((s, x) => s + (x.plateaux ?? 0), 0)
        return (
          <fieldset key={l.cle} className="ligne-repartition" aria-label={`Ligne ${i + 1}`}>
            <ChampClient libelle={`Client ${i + 1}`} clients={clients} valeur={l.client_id}
              onChange={(id) => maj(l.cle, { client_id: id, ...(id && l.prix == null ? { prix: prixHabituel(id, l.calibre) } : {}) })}
              onAjouter={async (nom) => {
                const id = crypto.randomUUID()
                await enregistrer('clients', { id, nom })
                maj(l.cle, { client_id: id })
              }} />
            <div className={`choix-calibre${!l.calibre && (l.client_id || l.plateaux) ? ' a-choisir' : ''}`} role="group" aria-label={`Calibre client ${i + 1}`}>
              {CALIBRES.map((c) => (
                <button type="button" key={c} disabled={!proposables.includes(c)} className={l.calibre === c ? 'choisi' : ''} aria-pressed={l.calibre === c}
                  onClick={() => maj(l.cle, { calibre: c, ...(l.client_id ? { prix: prixHabituel(l.client_id, c) ?? l.prix } : {}) })}>{NOM_CALIBRE[c]}</button>
              ))}
            </div>
            <div className="grille2">
              <ChampMontant libelle="Plateaux" valeur={l.plateaux} onChange={(n) => maj(l.cle, { plateaux: n })} />
              <ChampMontant libelle="Prix du plateau" valeur={l.prix} onChange={(n) => maj(l.cle, { prix: n })} />
            </div>
            {l.plateaux != null && (
              <div className="discret" style={{ margin: '-4px 0 8px', fontWeight: 700 }}>
                {plusieurs ? `${nomCle(stock)} : ` : ''}{pluriel(avant)} − {l.plateaux} = <span className={avant - l.plateaux < 0 ? 'mauvais' : 'ok'}>{pluriel(avant - l.plateaux)}</span>
                {l.prix ? ` · ${formatFCFA(l.plateaux * l.prix)}` : ''}
              </div>
            )}
            <div className="grille3 choix-paiement" role="group" aria-label={`Paiement client ${i + 1}`}>
              {([['credit', 'À crédit'], ['paye', 'Payé'], ['partie', 'En partie']] as const).map(([v, libelle]) => (
                <button type="button" key={v} className={l.paiement === v ? 'choisi' : ''} onClick={() => maj(l.cle, { paiement: v })}>{libelle}</button>
              ))}
            </div>
            {l.paiement === 'partie' && <ChampMontant libelle="Montant payé" valeur={l.paye} onChange={(n) => maj(l.cle, { paye: n })} />}
            {lignes.length > 1 && (
              <button type="button" className="lien" onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}>
                <IconTrash size={16} aria-hidden="true" style={{ verticalAlign: 'middle' }} /> Retirer ce client
              </button>
            )}
          </fieldset>
        )
      })}

      <BoutonAjout onClick={() => setLignes((ls) => [...ls, nouvelleLigne({ calibre: premierCalibreLibre(Object.fromEntries(cles.map((k) => [k, resteDe(k)]))) })])} style={{ width: '100%', marginBottom: 10 }}>Ajouter un client</BoutonAjout>
      {erreur && <div className="erreur">{erreur}</div>}
      <div className="grille2">
        <button type="button" onClick={onFini}>Annuler</button>
        <button type="submit" className="principal" disabled={enCours || tropQuelquePart}>Enregistrer les ventes</button>
      </div>
    </form>
  )
}
