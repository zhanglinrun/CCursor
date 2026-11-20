import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { expect, it } from 'vitest'
import { getRoutesFilePath } from '../config/paths'
import { ensureRoutesFile, loadRoutes, setByokMode } from '../config/routesStore'

const obsolete = 'aiserver.v1.DashboardService/GetEffectiveUserPlugins'

it('removes the legacy plugin redirect on upgrade and preserves custom routes', async () => {
  const path = getRoutesFilePath()
  const customRoute = 'aiserver.v1.Example/CustomMethod'
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ byokMode: 1, server: { port: 39832 }, redirect: [customRoute, obsolete] }))

  expect(loadRoutes().redirect).toEqual([customRoute])
  expect(await ensureRoutesFile()).toMatchObject({ byokMode: 1, server: { port: 39832 }, redirect: [customRoute] })
  expect(JSON.parse(readFileSync(path, 'utf8')).redirect).toEqual([customRoute])
  expect((await setByokMode(1)).redirect).not.toContain(obsolete)
})
