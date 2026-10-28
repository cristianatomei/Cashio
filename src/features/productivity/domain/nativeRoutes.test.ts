/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../../..');
const native = resolve(root, 'modules/productivity/android/src/main');
const read = (file: string) => readFileSync(resolve(native, file), 'utf8');

it('wires widget and tile through the existing Expo Router add screen', () => {
  const widget = read('java/expo/modules/productivity/CashioWidget.kt');
  const tile = read('java/expo/modules/productivity/CashioTile.kt');
  const module = read('java/expo/modules/productivity/ProductivityModule.kt');
  expect(widget).toContain('"cashio:///add-transaction"');
  expect(widget).toContain('cashioPendingIntent(context, true)');
  expect(tile).toContain('cashioPendingIntent(this, true)');
  expect(tile).toContain('launchCashio(this, true)');
  expect(module).toContain('.setIntent(launchCashio(context, true))');
  expect(existsSync(resolve(root, 'src/app/add-transaction.tsx'))).toBe(true);
});

it('declares the widget and permission-protected Quick Settings tile in the library manifest', () => {
  const manifest = read('AndroidManifest.xml');
  expect(manifest).toContain('android:name=".CashioWidget"');
  expect(manifest).toContain('android:resource="@xml/cashio_widget"');
  expect(manifest).toContain('android:name=".CashioTile"');
  expect(manifest).toContain('android.permission.BIND_QUICK_SETTINGS_TILE');
});

it('has matching RO and EN native labels', () => {
  const names = (xml: string) =>
    [...xml.matchAll(/<string name="([^"]+)"/g)].map((match) => match[1]).sort();
  expect(names(read('res/values/strings.xml'))).toEqual(names(read('res/values-ro/strings.xml')));
});
