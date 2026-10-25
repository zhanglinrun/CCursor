import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { catalogModelDefaults, matchCatalogModel } from '../../shared/catalogModelDefaults'
import { parseCatalog } from '../config/catalogStore'

const snapshot = JSON.parse(readFileSync(resolve('..', 'installer/assets/models-catalog.json'), 'utf8'))
const entries = parseCatalog(snapshot.catalog)

it.each(['gpt-6.1-sol', 'gpt-5.6-terra', 'gpt-6-luna'])('selects official metadata and full defaults for %s', (id) => {
  const entry = matchCatalogModel(entries, id)!
  expect(entry.providerKey).toBe('openai')
  expect(entry.id).toBe(id)
  expect(catalogModelDefaults(entry, 'https://relay.invalid', id)).toMatchObject({
    type: 'openai-chat',
    contextTokenLimit: 1050000,
    maxOutputTokens: 128000,
    thinking: true,
    supportsAgent: true,
    supportsImages: true,
    fastMode: false,
    parameters: { context: [272000, 1050000], fast: true },
  })
})

it('uses exact reseller aliases rather than rewriting them to another provider id', () => {
  const entry = matchCatalogModel(entries, 'openai-gpt-61-sol')!
  expect(entry.providerKey).toBe('venice')
  expect(entry.canonicalId).toBe('openai/gpt-6.1-sol')
})

it('does not use fuzzy neighbors or arbitrary conflicting reseller records', () => {
  expect(matchCatalogModel(entries, 'gpt-6.1-sol-unknown-suffix')).toBeUndefined()
  const sample = { providerName: 'Synthetic', id: 'synthetic-model', name: 'Synthetic', contextLimit: 32000, reasoning: false, toolCall: true, hasImages: false }
  const choices = [{ ...sample, providerKey: 'a' }, { ...sample, providerKey: 'b', contextLimit: 64000 }]
  expect(matchCatalogModel(choices, 'synthetic-model')).toBeUndefined()
  expect(matchCatalogModel(choices, 'synthetic-model', '', 'b')?.providerKey).toBe('b')
})

it('does not expose unsupported reasoning levels and disables reasoning for non-reasoning models', () => {
  const entry = matchCatalogModel(entries, 'gpt-6.1-sol')!
  expect(catalogModelDefaults(entry, 'https://relay.invalid', entry.id).parameters?.reasoning).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  const plain = catalogModelDefaults({ ...entry, reasoning: false }, 'https://relay.invalid', entry.id)
  expect(plain.thinking).toBe(false)
  expect(plain.parameters?.reasoning).toBeUndefined()
})
