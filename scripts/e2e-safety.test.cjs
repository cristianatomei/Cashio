const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const configure = require('../app.config.js');
const { loadTypeScript } = require('./sqlite-test-support.cjs');

test('E2E build is explicit, has a separate app identity and cannot activate test initialization in production', () => {
  const previous = process.env.CASHIO_E2E;
  const { expo } = require('../app.json');
  try {
    delete process.env.CASHIO_E2E;
    assert.deepEqual(configure({ config: expo }), expo);
    for (const value of ['0', 'true', 'false', '']) {
      process.env.CASHIO_E2E = value;
      assert.deepEqual(configure({ config: expo }), expo);
    }
    process.env.CASHIO_E2E = '1';
    const config = configure({ config: expo });
    assert.equal(config.android.package, 'com.cashio.app.e2e');
    assert.equal(config.ios.bundleIdentifier, 'com.cashio.app.e2e');
    assert.equal(config.scheme, 'cashio-e2e');
    assert.equal(config.extra.disposableSyntheticE2E, true);
    for (const [candidate, expected] of [
      [config, true],
      [expo, false],
      [{ ...config, android: expo.android }, false],
      [{ ...config, extra: {} }, false],
      [{ ...config, extra: { disposableSyntheticE2E: 'true' } }, false],
      [{ ...config, android: undefined }, false],
      [{ ...config, android: { package: 'com.cashio.app.e2e.other' } }, false],
    ]) {
      const { isDisposableTestBuild } = loadTypeScript('src/core/db/testBuild.ts', {
        'expo-constants': { __esModule: true, default: { expoConfig: candidate } },
      });
      assert.equal(isDisposableTestBuild, expected);
    }
  } finally {
    if (previous === undefined) delete process.env.CASHIO_E2E;
    else process.env.CASHIO_E2E = previous;
  }
});

test('every destructive Maestro setup and flow is pinned to the disposable synthetic app', () => {
  for (const directory of ['.maestro/setup', '.maestro/flows']) {
    for (const file of fs.readdirSync(directory)) {
      const flow = fs.readFileSync(`${directory}/${file}`, 'utf8');
      assert.match(flow, /^appId: com\.cashio\.app\.e2e\n/);
      assert.doesNotMatch(flow, /appId: com\.cashio\.app\s*\n/);
      if (directory.endsWith('flows')) assert.match(flow, /runFlow: \.\.\/setup\/onboarding\.yaml/);
    }
  }
});
