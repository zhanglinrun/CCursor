import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { patchGlassModelRefresh } from '../src/patch-glass-refresh.js';

function fixture(watch = '') {
  return `class Service {
    constructor(){this._cursorAuthenticationService={isAuthenticated:()=>false};this.seed=0;this.watch=0;this.fetch=0}
    trySeedCatalogFromOwnKey(){this.seed++}
    watchPrivateInferenceCatalog(){this.watch++}
    async refreshDefaultModels(){if(this.trySeedCatalogFromOwnKey(),${watch}!this._cursorAuthenticationService.isAuthenticated()){return}this.fetch++}
  };globalThis.Service=Service;`;
}

for (const watch of ['', 'this.watchPrivateInferenceCatalog(),']) {
  test(`refresh preserves authentication and intermediate calls (${watch || 'standard'})`, async () => {
    const source = fixture(watch);
    const patched = patchGlassModelRefresh(source);
    assert.equal(patched.patched, true);
    const context = vm.createContext({});
    vm.runInContext(patched.source, context);
    const service = new context.Service();
    await service.refreshDefaultModels();
    assert.equal(service.fetch, 0);
    context.__byokForceRefresh = true;
    await service.refreshDefaultModels();
    assert.equal(service.fetch, 1);
    assert.equal(service.seed, 2);
    assert.equal(service.watch, watch ? 2 : 0);
    assert.deepEqual(patchGlassModelRefresh(patched.source), { source: patched.source, patched: false });
  });
}

test('unknown or ambiguous refresh methods fail visibly', () => {
  assert.throws(() => patchGlassModelRefresh('class Service {}'), /matched 0 times/);
  assert.throws(() => patchGlassModelRefresh(fixture() + fixture()), /matched 2 times/);
});
