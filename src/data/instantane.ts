import { createStore, get, set } from 'idb-keyval'

const store = createStore('the-good-farm-instantane', 'donnees')

/** Dernières données reçues du serveur, pour ouvrir l'appli et saisir même sans réseau. */
export function sauverInstantane(d: unknown): Promise<void> {
  return set('donnees', d, store)
}

export async function lireInstantane<T>(): Promise<T | null> {
  return (await get<T>('donnees', store)) ?? null
}
