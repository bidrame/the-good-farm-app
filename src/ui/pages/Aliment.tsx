import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDonnees } from '../../data/useDonnees'
import { etatAliment, JOURS_ALERTE_ALIMENT, KG_PAR_SAC, prixHabituelSac, produitsAliment, sacsLivres } from '../../lib/calculs/aliment'
import { bandesEnProduction, effectifActuel, estVerifiee } from '../../lib/calculs/bandes'
import { aujourdhui, formatDate } from '../../lib/format'
import type { ReglagesAliment } from '../../lib/types'
import { ChampMontant } from '../composants/communs'
import { BoutonAjout, Titre } from '../composants/Pastille'
import { Reglette } from '../composants/Reglette'

/** Repères habituels pour des pondeuses en production. */
const GRAMMES_NORMAUX = [110, 125]

function Inventaire({ reglage }: { reglage: ReglagesAliment }) {
  const { enregistrer } = useDonnees()
  const [sacs, setSacs] = useState<number | null>(null)
  const [fait, setFait] = useState(false)
  return (
    <section className="carte" aria-label="Compter les sacs">
      <h2 style={{ marginTop: 0 }}>Compter les sacs au magasin</h2>
      <p className="discret" style={{ marginTop: 0 }}>
        Comptez les sacs pleins ce soir : l’appli suivra ensuite le stock toute seule (livraisons − consommation).
        {reglage.stock && ` Dernier comptage : ${reglage.stock.sacs} sacs le ${formatDate(reglage.stock.date)}.`}
      </p>
      <ChampMontant libelle="Sacs pleins" valeur={sacs} onChange={(n) => { setSacs(n); setFait(false) }} />
      <button className="principal" disabled={sacs == null} onClick={async () => {
        await enregistrer('reglages', { id: 1, aliment: { ...reglage, stock: { date: aujourdhui(), sacs: sacs ?? 0 } } })
        setFait(true)
        setSacs(null)
      }}>Enregistrer le comptage</button>
      {fait && <p className="ok">Comptage enregistré ✓</p>}
    </section>
  )
}

function ReglagesAlimentation({ reglage }: { reglage: ReglagesAliment }) {
  const { produits, enregistrer } = useDonnees()
  const ids = produitsAliment(produits, reglage)
  const sauver = (p: Partial<ReglagesAliment>) => enregistrer('reglages', { id: 1, aliment: { ...reglage, ...p } })
  return (
    <details className="avance carte">
      <summary>Réglages de l’aliment</summary>
      <p className="phrases-alerte" style={{ marginTop: 10 }}>
        Un sac pèse <Reglette libelle="Poids d’un sac (kg)" valeur={reglage.kg_par_sac || KG_PAR_SAC} min={5} max={100} pas={5} onChange={(n) => sauver({ kg_par_sac: n })} /> kg
      </p>
      <p className="phrases-alerte">
        Prévenez-moi quand il reste moins de{' '}
        <Reglette libelle="Alerte aliment (jours)" valeur={reglage.jours_alerte || JOURS_ALERTE_ALIMENT} min={1} max={30} onChange={(n) => sauver({ jours_alerte: n })} /> jours
      </p>
      <p className="discret" style={{ marginBottom: 4 }}>Achats comptés comme aliment des pondeuses :</p>
      {produits.filter((p) => p.type === 'depense' && !p.supprime_le && p.actif).sort((a, b) => a.nom.localeCompare(b.nom)).map((p) => (
        <label key={p.id} className="case">
          <input type="checkbox" checked={ids.includes(p.id)}
            onChange={(e) => sauver({ produit_ids: e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id) })} />
          <span>{p.nom}</span>
        </label>
      ))}
    </details>
  )
}

export function Aliment() {
  const { transactions, ponte, produits, clients, bandes, recensements, mortalites, reglages } = useDonnees()
  const navigate = useNavigate()
  const reglage: ReglagesAliment = reglages[0]?.aliment ?? {}
  const ref = aujourdhui()
  const e = etatAliment({ transactions, pontes: ponte, produits, reglage }, ref)
  const kgSac = reglage.kg_par_sac || KG_PAR_SAC
  const alerte = reglage.jours_alerte || JOURS_ALERTE_ALIMENT

  const enProd = bandesEnProduction(bandes, ponte, ref)
  const poules = enProd.reduce((s, b) => s + effectifActuel(b, ponte, undefined, recensements, mortalites), 0)
  const douteux = enProd.some((b) => !estVerifiee(b, recensements))
  const grammes = e.kgParJour && poules ? Math.round((e.kgParJour * 1000) / poules) : null

  const ids = produitsAliment(produits, reglage)
  const achats = transactions.filter((t) => !t.supprime_le && t.type === 'depense' && ids.includes(t.produit_id)).sort((a, b) => b.date.localeCompare(a.date))
  const prixSac = prixHabituelSac(achats)

  return (
    <main>
      <Titre genre="aliment">Aliment</Titre>

      {e.jours != null ? (
        <section aria-label="Stock d’aliment" className={`vedette${e.jours <= alerte ? ' vedette-alerte' : ''}`}>
          <div className="discret">Il reste environ</div>
          <div className="grand">{e.stockSacs} sacs</div>
          <div className="variation">
            ≈ {e.jours} jour{e.jours > 1 ? 's' : ''} d’aliment{e.jours <= alerte ? ' : pensez à commander' : ''}
          </div>
        </section>
      ) : (
        <p className="alerte info" style={{ display: 'block' }}>Comptez une fois les sacs au magasin pour que l’appli suive le stock et vous prévienne avant la rupture.</p>
      )}

      <section className="carte" aria-label="Consommation">
        <h2 style={{ marginTop: 0 }}>Consommation</h2>
        {e.kgParJour == null ? <p className="discret">Pas encore de livraison ni d’aliment noté avec la ponte.</p> : (
          <>
            <div className="ligne"><span>La ferme mange</span><strong>≈ {Math.round(e.kgParJour)} kg / jour</strong></div>
            <div className="ligne"><span>Soit</span><strong>≈ {(e.kgParJour / kgSac).toFixed(1).replace('.', ',')} sacs / jour</strong></div>
            {grammes != null && (
              <div className="ligne">
                <span>Par poule</span>
                <strong className={grammes > GRAMMES_NORMAUX[1] * 1.15 || grammes < GRAMMES_NORMAUX[0] * 0.85 ? 'moyen' : ''}>≈ {grammes} g / jour</strong>
              </div>
            )}
            <p className="discret" style={{ marginBottom: 0 }}>
              {e.source === 'ponte' ? 'D’après l’aliment noté avec la ponte.' : 'D’après les livraisons des 60 derniers jours. Notez l’aliment avec la ponte pour plus de précision.'}
              {grammes != null && ` Une pondeuse mange d’habitude ${GRAMMES_NORMAUX[0]} à ${GRAMMES_NORMAUX[1]} g par jour${douteux ? ' (vos effectifs restent à vérifier)' : ''}.`}
            </p>
          </>
        )}
      </section>

      <BoutonAjout onClick={() => navigate('/saisir?type=depense')} style={{ width: '100%', marginBottom: 12 }}>Noter une livraison d’aliment</BoutonAjout>

      <Inventaire reglage={reglage} />

      {achats.length > 0 && (
        <section className="carte" aria-label="Dernières livraisons">
          <h2 style={{ marginTop: 0 }}>Dernières livraisons</h2>
          {achats.slice(0, 5).map((t) => (
            <div key={t.id} className="ligne">
              <span>{formatDate(t.date)} <span className="discret">{clients.find((c) => c.id === t.client_id)?.nom ?? ''}</span></span>
              <strong>{sacsLivres(t, prixSac)} sacs</strong>
            </div>
          ))}
        </section>
      )}

      <ReglagesAlimentation reglage={reglage} />
    </main>
  )
}
