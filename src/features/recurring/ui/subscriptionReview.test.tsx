import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import type { ReactElement } from 'react';
import { en } from '@/core/i18n/locales/en';
import { ro } from '@/core/i18n/locales/ro';
import { AppText, Button, SheetModal, TextField } from '@/core/ui';
import { expense } from '@/features/stats/domain/fixtures.test-helper';
import { detectSpendingInsights } from '@/features/stats/domain/insights';
import type { RecurringRule } from '../data/recurringRepo';
import {
  confirmSubscription,
  ignoreSubscription,
  restoreSubscription,
  SubscriptionReviewError,
} from '../data/subscriptionReviewRepo';
import { reviewKey } from '../domain/subscriptionReview';
import { RecurringFormModal } from './RecurringFormModal';
import { SubscriptionSuggestions } from './SubscriptionSuggestions';
import { ConfirmedRecurringTotals } from './ConfirmedRecurringTotals';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/core/db', () => ({
  schema: jest.requireActual('@/core/db/schema'),
  useDb: () => ({ select: () => ({ from: () => ({ where: () => ({}) }) }) }),
}));
let mockSettings: { value: string }[] = [];
let mockRules: RecurringRule[] = [];
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: () => ({ data: mockSettings }),
}));
jest.mock('../data/queries', () => ({ useRecurringRules: () => mockRules }));
jest.mock('../data/subscriptionReviewRepo', () => ({
  ...jest.requireActual('../data/subscriptionReviewRepo'),
  confirmSubscription: jest.fn(() => 1),
  ignoreSubscription: jest.fn(),
  restoreSubscription: jest.fn(),
}));
jest.mock('../data/reminders', () => ({
  syncRecurringReminder: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/accounts', () => ({
  useAccounts: () => [{ id: 1, name: 'Account' }],
  AccountPickerModal: () => null,
}));
jest.mock('@/features/categories', () => ({
  useTaxonomy: () => [],
  CategoryPickerModal: () => null,
}));
jest.mock('@/features/merchants', () => ({
  useMerchants: () => [{ id: 1, name: 'Service' }],
  MerchantPickerModal: () => null,
}));
jest.mock('@/core/ui/theme', () => ({
  ...jest.requireActual('@/core/ui/theme/tokens'),
  useTheme: () => ({ colors: jest.requireActual('@/core/ui/theme/palette').lightColors }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'CategoryGlyph');

const now = new Date(2026, 9, 20).getTime();
const evidence = [expense(7), expense(8), expense(9)];
const insights = detectSpendingInsights(evidence, now);
const suggestion = { insight: insights[0], evidence };
const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: en }, ro: { translation: ro } },
  interpolation: { escapeValue: false },
  initAsync: false,
});
const renderers: ReactTestRenderer[] = [];
async function render(element: ReactElement) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>);
  });
  renderers.push(renderer);
  return renderer.root;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = [];
  mockRules = [];
  jest.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(async () => {
  await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount()));
  jest.restoreAllMocks();
});

it.each(['en', 'ro'] as const)(
  'reviews and edits before explicit confirmation in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    const copy = language === 'en' ? en : ro;
    const root = await render(<SubscriptionSuggestions insights={insights} rows={evidence} />);
    const button = (title: string) =>
      root.findAllByType(Button).find((item) => item.props.title === title)!;
    expect(root.findAllByType(RecurringFormModal)).toHaveLength(0);
    await act(async () => button(copy.insights.review).props.onPress());
    expect(confirmSubscription).not.toHaveBeenCalled();
    const field = (label: string) =>
      root.findAllByType(TextField).find((item) => item.props.label === label)!;
    expect(field(copy.recurring.name).props.value).toBe('Service');
    expect(field(copy.recurring.amount).props.value).toBe('10.00');
    expect(field(copy.accounts.currency).props.value).toBe('RON');
    await act(async () => field(copy.recurring.amount).props.onChangeText('12.50'));
    await act(async () => button(copy.insights.confirm).props.onPress());
    expect(confirmSubscription).toHaveBeenCalledTimes(1);
    expect(confirmSubscription).toHaveBeenCalledWith(
      expect.anything(),
      suggestion,
      expect.objectContaining({
        amountMinor: 1250,
        merchantId: 1,
        currency: 'RON',
        frequency: 'monthly',
        interval: 1,
      }),
    );
    expect(root.findAllByType(RecurringFormModal)).toHaveLength(0);
  },
);

it('navigates to a supporting payment, closing the review without saving', async () => {
  await i18n.changeLanguage('en');
  const onClose = jest.fn();
  const root = await render(<RecurringFormModal suggestion={suggestion} onClose={onClose} />);
  const evidenceButton = root
    .findAllByType(Button)
    .find((item) => item.props.title.startsWith('Payment #8'))!;
  await act(async () => evidenceButton.props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/add-transaction', params: { id: '8' } });
  expect(confirmSubscription).not.toHaveBeenCalled();
  await act(async () => root.findByType(SheetModal).props.onClose());
  expect(confirmSubscription).not.toHaveBeenCalled();
});

it('persists ignore without saving an obligation, and offers restore without current evidence', async () => {
  await i18n.changeLanguage('en');
  const root = await render(<SubscriptionSuggestions insights={insights} rows={evidence} />);
  await act(async () =>
    root
      .findAllByType(Button)
      .find((item) => item.props.title === en.insights.ignore)!
      .props.onPress(),
  );
  expect(ignoreSubscription).toHaveBeenCalledWith(expect.anything(), suggestion);
  expect(confirmSubscription).not.toHaveBeenCalled();
  mockSettings = [
    {
      value: JSON.stringify([
        {
          key: reviewKey(insights[0]),
          merchant: 'Service',
          currency: 'RON',
          ignored: true,
          ruleId: null,
        },
      ]),
    },
  ];
  const ignored = await render(<SubscriptionSuggestions insights={[]} rows={[]} />);
  expect(
    ignored.findAllByType(Button).some((item) => item.props.title === en.insights.review),
  ).toBe(false);
  await act(async () => ignored.findByType(Button).props.onPress());
  expect(restoreSubscription).toHaveBeenCalledWith(expect.anything(), reviewKey(insights[0]));
});

it('opens an existing paused obligation for review rather than prefilling a new one', async () => {
  await i18n.changeLanguage('en');
  mockRules = [
    {
      id: 1,
      accountId: 1,
      type: 'expense',
      amountMinor: 900,
      currency: 'RON',
      merchantId: 1,
      categoryId: null,
      note: 'Service',
      frequency: 'monthly',
      interval: 1,
      nextDue: now,
      endAt: null,
      active: false,
      amountVariable: false,
      autoPost: false,
      createdAt: 1,
    },
  ];
  const root = await render(<SubscriptionSuggestions insights={insights} rows={evidence} />);
  expect(root.findAllByType(Button).some((item) => item.props.title === en.insights.review)).toBe(
    false,
  );
  await act(async () =>
    root
      .findAllByType(Button)
      .find((item) => item.props.title === en.insights.openExisting)!
      .props.onPress(),
  );
  expect(root.findByType(RecurringFormModal).props.rule.id).toBe(1);
  expect(confirmSubscription).not.toHaveBeenCalled();
});

it('keeps the form open and reports a duplicate discovered during confirmation', async () => {
  await i18n.changeLanguage('en');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(confirmSubscription).mockImplementationOnce(() => {
    throw new SubscriptionReviewError('duplicate');
  });
  const onClose = jest.fn();
  const root = await render(<RecurringFormModal suggestion={suggestion} onClose={onClose} />);
  await act(async () =>
    root
      .findAllByType(Button)
      .find((item) => item.props.title === en.insights.confirm)!
      .props.onPress(),
  );
  expect(alert).toHaveBeenCalledWith(en.errors.generic, en.insights.duplicate);
  expect(onClose).not.toHaveBeenCalled();
});

it('shows a confirmed-total empty state without counting unconfirmed suggestions', async () => {
  await i18n.changeLanguage('en');
  const root = await render(<ConfirmedRecurringTotals now={now} />);
  expect(
    root.findAllByType(AppText).some((item) => item.props.children === en.insights.noConfirmed),
  ).toBe(true);
});

it('renders monthly and annual confirmed totals separately for each original currency', async () => {
  await i18n.changeLanguage('en');
  const rule: RecurringRule = {
    id: 1,
    accountId: 1,
    type: 'expense',
    amountMinor: 1000,
    currency: 'RON',
    merchantId: 1,
    categoryId: null,
    note: 'Service',
    frequency: 'monthly',
    interval: 1,
    nextDue: now,
    endAt: null,
    active: true,
    amountVariable: false,
    autoPost: false,
    createdAt: 1,
  };
  mockRules = [
    rule,
    { ...rule, id: 2, currency: 'EUR', frequency: 'yearly', amountMinor: 12000 },
    { ...rule, id: 3, currency: 'USD', active: false },
  ];
  const root = await render(<ConfirmedRecurringTotals now={now} />);
  const rows = root.findAllByType(AppText).map((item) => item.props.children);
  expect(rows).toContain('RON · RON\u00a010.00 / month · RON\u00a0120.00 / year');
  expect(rows).toContain('EUR · €10.00 / month · €120.00 / year');
  expect(rows.some((text) => typeof text === 'string' && text.startsWith('USD ·'))).toBe(false);
});
