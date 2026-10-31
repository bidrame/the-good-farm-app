// Usage : npx tsx scripts/import/verifierTotaux.ts — compare les totaux en base à ceux du classeur.
import { formatFCFA } from '../../src/lib/format'
import type { Transaction } from '../../src/lib/types'
import { lireTotauxAttendus, totauxParAnnee } from './construireImport'
import { clientAdmin } from './env'

async function main() {
  const sb = clientAdmin()
  const txs: Transaction[] = []
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await sb.from('transactions').select('date,type,montant').is('supprime_le', null).range(debut, debut + 999)
    if (error) throw error
    txs.push(...(data as Transaction[]))
    if (data.length < 1000) break
  }
  const t = totauxParAnnee(txs)
  let ok = true
  for (const [cle, attendu] of Object.entries(lireTotauxAttendus())) {
    const lu = t[cle] ?? { ventes: 0, depenses: 0 }
    const egal = lu.ventes === attendu.ventes && lu.depenses === attendu.depenses
    ok &&= egal
    console.log(`${egal ? 'OK ' : 'ÉCART'} ${cle} : ventes ${formatFCFA(lu.ventes)} / dépenses ${formatFCFA(lu.depenses)}`)
  }
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
