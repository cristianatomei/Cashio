import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { en } from '@/core/i18n/locales/en';
import { ro } from '@/core/i18n/locales/ro';

import { ReceiptField, type ReceiptDraft } from './ReceiptField';
import { checkInterruptedReceipt, pickReceipt } from '../data/picker';
import { receiptUri } from '../data/files';
import { ReceiptError } from '../domain/receipt';

jest.mock('../data/picker', () => ({
  checkInterruptedReceipt: jest.fn(),
  pickReceipt: jest.fn(),
}));
jest.mock('../data/files', () => ({ receiptUri: jest.fn() }));
jest.mock('@/core/ui', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    AppText: Text,
    Card: View,
    Button: 'ReceiptButton',
    SheetModal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? React.createElement(View, null, children) : null,
  };
});

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: en }, ro: { translation: ro } },
  initAsync: false,
});
let renderer: ReactTestRenderer;
const changed = jest.fn();
const busy = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(checkInterruptedReceipt).mockResolvedValue();
  jest.mocked(receiptUri).mockReturnValue('file:///private/receipt.jpg');
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

async function render(value: ReceiptDraft) {
  await act(async () => {
    renderer = create(
      <I18nextProvider i18n={i18n}>
        <ReceiptField value={value} onChange={changed} onBusy={busy} />
      </I18nextProvider>,
    );
  });
}
async function press(title: string) {
  await act(async () => {
    renderer.root.find((node) => node.props.title === title).props.onPress();
  });
}

it.each(['en', 'ro'] as const)(
  'handles choose/cancel/remove as unsaved drafts in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    await render({ filename: 'original.jpg' });
    jest.mocked(pickReceipt).mockResolvedValue(null);
    await press(i18n.t('receipts.library'));
    expect(changed).not.toHaveBeenCalled();
    jest.mocked(pickReceipt).mockResolvedValue('file:///picker/new.jpg');
    await press(i18n.t('receipts.library'));
    expect(changed).toHaveBeenLastCalledWith({ uri: 'file:///picker/new.jpg' });
    expect(busy.mock.calls).toEqual([[true], [false], [true], [false]]);
    await press(i18n.t('receipts.remove'));
    expect(changed).toHaveBeenLastCalledWith(null);
  },
);

it('opens existing receipt locally and reports a missing file without changing the saved draft', async () => {
  await i18n.changeLanguage('en');
  await render({ filename: 'original.jpg' });
  await press(en.receipts.view);
  expect(receiptUri).toHaveBeenCalledWith('original.jpg');
  expect(
    renderer.root.findAll((node) => node.props.source?.uri === 'file:///private/receipt.jpg')
      .length,
  ).toBeGreaterThan(0);
  jest.mocked(receiptUri).mockImplementation(() => {
    throw new ReceiptError('missing');
  });
  await press(en.receipts.view);
  expect(Alert.alert).toHaveBeenLastCalledWith(en.receipts.title, en.receipts.missing);
  expect(changed).not.toHaveBeenCalled();
});

it('shows permission/import errors and interrupted picker recovery explicitly', async () => {
  await i18n.changeLanguage('en');
  jest.mocked(checkInterruptedReceipt).mockRejectedValue(new ReceiptError('interrupted'));
  await render(null);
  expect(Alert.alert).toHaveBeenLastCalledWith(en.receipts.title, en.receipts.interrupted);
  for (const code of ['permission', 'importFailed'] as const) {
    jest.mocked(pickReceipt).mockRejectedValue(new ReceiptError(code));
    await press(en.receipts.camera);
    expect(Alert.alert).toHaveBeenLastCalledWith(en.receipts.title, en.receipts[code]);
    expect(busy).toHaveBeenLastCalledWith(false);
  }
  expect(changed).not.toHaveBeenCalled();
});
