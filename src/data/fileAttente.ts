import { createStore, get, set } from 'idb-keyval'

export type NomTable = 'clients' | 'produits' | 'ouvriers' | 'transactions' | 'paiements' | 'bandes' | 'ponte' | 'reglages' | 'profils' | 'recensements' | 'mortalites' | 'ramassages'

export type Operation = {
  id: string
  table: NomTable
  action: 'upsert' | 'supprimer' | 'restaurer'
  ligne: Record<string, unknown> & { id: string | number }
  /** Change à chaque ajout : permet de ne retirer que la version effectivement envoyée. */
  version?: string
}

export type Rejetee = { op: Operation; erreur: string; le: string }

const store = createStore('the-good-farm', 'file-attente')
const CLE = 'operations'
const CLE_REJETEES = 'rejetees'

// Les lectures/écritures de la file passent l'une après l'autre ; les envois réseau, eux, se font hors verrou.
let chaine: Promise<unknown> = Promise.resolve()
function enSerie<T>(f: () => Promise<T>): Promise<T> {
  const r = chaine.then(f, f)
  chaine = r.catch(() => undefined)
  return r
}

const lire = async () => (await get<Operation[]>(CLE, store)) ?? []
const ecrire = (ops: Operation[]) => set(CLE, ops, store)
const lireRejetees = async () => (await get<Rejetee[]>(CLE_REJETEES, store)) ?? []
const ecrireRejetees = (r: Rejetee[]) => set(CLE_REJETEES, r, store)

/** Erreur que le serveur renverra toujours (contrainte, donnée invalide, droits) : inutile de réessayer seul. */
export function estPermanente(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^(22|23|42)/.test(code)
}

const message = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string } | null)?.message ?? String(e))

export function lister(): Promise<Operation[]> {
  return enSerie(lire)
}

export function enAttente(): Promise<number> {
  return enSerie(async () => (await lire()).length)
}

export function listerRejetees(): Promise<Rejetee[]> {
  return enSerie(lireRejetees)
}

/** Ajoute une opération ; une opération de même id est remplacée à sa place d'origine (l'ordre des dépendances est gardé). */
export function ajouter(op: Operation): Promise<void> {
  return enSerie(async () => {
    const ops = await lire()
    const nouvelle = { ...op, version: crypto.randomUUID() }
    const i = ops.findIndex((o) => o.id === op.id)
    if (i >= 0) ops[i] = nouvelle
    else ops.push(nouvelle)
    await ecrire(ops)
  })
}

/**
 * Envoie les opérations dans l'ordre. Erreur passagère (réseau) : on s'arrête et on réessaiera.
 * Erreur définitive : l'opération est mise de côté (visible par l'utilisateur) et on continue.
 */
export async function rejouer(envoyer: (op: Operation) => Promise<void>): Promise<{ envoyees: number; restantes: number }> {
  const ops = await enSerie(lire)
  const faites: Operation[] = []
  const rejets: Rejetee[] = []
  for (const op of ops) {
    try {
      await envoyer(op)
      faites.push(op)
    } catch (e) {
      if (!estPermanente(e)) break
      rejets.push({ op, erreur: message(e), le: new Date().toISOString() })
    }
  }
  return enSerie(async () => {
    const retirer = new Set([...faites, ...rejets.map((r) => r.op)].map((o) => o.version))
    const restantes = (await lire()).filter((o) => !retirer.has(o.version))
    await ecrire(restantes)
    if (rejets.length > 0) await ecrireRejetees([...(await lireRejetees()), ...rejets])
    return { envoyees: faites.length, restantes: restantes.length }
  })
}

export async function reessayer(id: string): Promise<void> {
  const r = await enSerie(async () => {
    const tout = await lireRejetees()
    await ecrireRejetees(tout.filter((x) => x.op.id !== id))
    return tout.find((x) => x.op.id === id)
  })
  if (r) await ajouter(r.op)
}

export function abandonner(id: string): Promise<void> {
  return enSerie(async () => ecrireRejetees((await lireRejetees()).filter((x) => x.op.id !== id)))
}

export function vider(): Promise<void> {
  return enSerie(async () => {
    await ecrire([])
    await ecrireRejetees([])
  })
}
