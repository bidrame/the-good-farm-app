import type { SupabaseClient } from '@supabase/supabase-js'
import { ajouter, rejouer, type NomTable, type Operation } from './fileAttente'
import { supabase } from './supabase'

const TAILLE_PAGE = 1000
const CHAMPS_BASE = ['cree_le', 'cree_par', 'modifie_le', 'modifie_par', 'supprime_le']

/** Donne un id à la ligne et retire les champs que la base gère elle-même. */
export function preparerLigne<T extends Record<string, unknown>>(ligne: T): Record<string, unknown> & { id: string | number } {
  const l: Record<string, unknown> = { ...ligne }
  for (const c of CHAMPS_BASE) delete l[c]
  if (l.id == null) l.id = crypto.randomUUID()
  return l as Record<string, unknown> & { id: string | number }
}

export async function envoyerOperation(client: SupabaseClient, op: Operation): Promise<void> {
  const table = client.from(op.table)
  const { error } =
    op.action === 'upsert'
      ? await table.upsert(op.ligne, { onConflict: 'id' })
      : await table.update({ supprime_le: op.action === 'supprimer' ? new Date().toISOString() : null }).eq('id', op.ligne.id)
  if (error) throw error
}

export async function chargerTout<T>(client: SupabaseClient, table: NomTable): Promise<T[]> {
  const tout: T[] = []
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    // Tri stable : sans lui, Postgres peut renvoyer une ligne sur deux pages ou l'oublier.
    const { data, error } = await client.from(table).select('*').order('id').range(debut, debut + TAILLE_PAGE - 1)
    if (error) throw error
    tout.push(...(data as T[]))
    if (!data || data.length < TAILLE_PAGE) return tout
  }
}

/** Superpose les opérations en attente aux données chargées, pour que la saisie apparaisse aussitôt. */
export function appliquerEnAttente<D extends Partial<Record<NomTable, Record<string, unknown>[]>>>(donnees: D, ops: Operation[]): D {
  const r: Record<string, Record<string, unknown>[]> = {}
  for (const [t, lignes] of Object.entries(donnees)) r[t] = [...(lignes ?? [])]
  for (const op of ops) {
    const lignes = (r[op.table] ??= [])
    const i = lignes.findIndex((l) => l.id === op.ligne.id)
    const avant = i >= 0 ? lignes[i] : {}
    const apres =
      op.action === 'upsert'
        ? { ...avant, ...op.ligne }
        : { ...avant, supprime_le: op.action === 'supprimer' ? new Date().toISOString() : null }
    if (i >= 0) lignes[i] = apres
    else lignes.push(apres)
  }
  return r as D
}

let envoiEnCours: Promise<{ envoyees: number; restantes: number }> | null = null

export function synchroniser() {
  envoiEnCours ??= rejouer((op) => envoyerOperation(supabase, op)).finally(() => {
    envoiEnCours = null
  })
  return envoiEnCours
}

/** Supprimer et restaurer une même ligne partagent un id : seul le dernier état demandé est envoyé. */
export function idOperation(table: NomTable, action: Operation['action'], id: string | number): string {
  return action === 'upsert' ? `upsert:${table}:${id}` : `etat:${table}:${id}`
}

export async function enregistrer<T extends Record<string, unknown>>(table: NomTable, ligne: T): Promise<string | number> {
  const l = preparerLigne(ligne)
  await ajouter({ id: idOperation(table, 'upsert', l.id), table, action: 'upsert', ligne: l })
  void synchroniser()
  return l.id
}

export async function supprimer(table: NomTable, id: string): Promise<void> {
  await ajouter({ id: idOperation(table, 'supprimer', id), table, action: 'supprimer', ligne: { id } })
  void synchroniser()
}

export async function restaurer(table: NomTable, id: string): Promise<void> {
  await ajouter({ id: idOperation(table, 'restaurer', id), table, action: 'restaurer', ligne: { id } })
  void synchroniser()
}
