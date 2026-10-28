const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const { createRequire } = require('node:module');

function loadTypeScript(relativePath, overrides = {}) {
  const filename = path.resolve(process.cwd(), relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const requireFromFile = createRequire(filename);
  const resolve = (specifier) => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith('@/'))
      return loadTypeScript(`src/${specifier.slice(2)}.ts`, overrides);
    if (specifier.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), `${specifier}.ts`);
      if (fs.existsSync(target)) return loadTypeScript(target, overrides);
    }
    return requireFromFile(specifier);
  };
  new Function('module', 'exports', 'require', source)(module, module.exports, resolve);
  return module.exports;
}

function createDatabase() {
  // In-memory real SQLite: no file path, phone database, or user data is accepted.
  const native = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql) => native.exec(sql),
    getFirstAsync: async (sql, ...args) =>
      native.prepare(sql).get(...(Array.isArray(args[0]) ? args[0] : args)),
    getAllAsync: async (sql, ...args) =>
      native.prepare(sql).all(...(Array.isArray(args[0]) ? args[0] : args)),
    runAsync: async (sql, ...args) =>
      native.prepare(sql).run(...(Array.isArray(args[0]) ? args[0] : args)),
    withTransactionAsync: async (fn) => transaction(() => fn()),
    withExclusiveTransactionAsync: async (fn) => transaction(() => fn(adapter)),
  };
  async function transaction(fn) {
    native.exec('BEGIN IMMEDIATE');
    try {
      await fn();
      native.exec('COMMIT');
    } catch (error) {
      native.exec('ROLLBACK');
      throw error;
    }
  }
  return { native, adapter };
}

module.exports = { createDatabase, loadTypeScript };
