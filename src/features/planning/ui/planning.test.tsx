import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import type { ReactElement } from 'react';

import GoalsScreen from '@/app/goals';
import NetWorthScreen from '@/app/net-worth';
import { en } from '@/core/i18n/locales/en';
import { ro } from '@/core/i18n/locales/ro';
import { ProgressBar } from '@/core/ui';
import { calculateNetWorth } from '../domain/netWorth';
import { saveGoal } from '../data/repo';
import { GoalSummary } from './GoalSummary';
import { PlanningButton } from './PlanningButton';
import { PlanningCards } from './PlanningCards';

jest.mock('@/core/db', () => ({ useDb: () => ({}) }));
jest.mock('../data/repo', () => ({
  saveGoal: jest.fn(),
  deleteGoal: jest.fn(),
  saveValuation: jest.fn(),
}));
jest.mock('../data/queries', () => ({
  useGoals: () => ({ data: [], updatedAt: new Date(1) }),
  usePlanningCurrency: () => 'RON',
  useNetWorth: () => mockWorth,
}));
jest.mock('./usePlanningTime', () => ({ usePlanningTime: () => 1 }));
jest.mock('@/core/ui/theme', () => ({
  ...jest.requireActual('@/core/ui/theme/tokens'),
  useTheme: () => ({ colors: jest.requireActual('@/core/ui/theme/palette').lightColors }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'CategoryGlyph');
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const unknownWorth = calculateNetWorth({
  baseCurrency: 'RON',
  asOf: 1,
  accounts: [{ id: 1, name: 'Synthetic account', currency: 'RON', openingBalanceMinor: 10000 }],
  transactions: [],
  assets: [],
  valuations: [],
  rates: [],
  loans: [{ id: 1, name: 'Synthetic loan', currency: 'RON', installmentsJson: '{}' }],
});
let mockWorth = {
  ...unknownWorth,
  assets: [],
  valuations: [],
  loading: false,
  error: undefined as Error | undefined,
};
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
  mockWorth = { ...unknownWorth, assets: [], valuations: [], loading: false, error: undefined };
});
afterEach(async () => {
  await act(async () => {
    renderers.splice(0).forEach((renderer) => renderer.unmount());
  });
});

it.each(['en', 'ro'] as const)(
  'announces named goal progress and remaining amounts in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    const root = await render(
      <GoalSummary
        goal={{
          id: 1,
          name: 'Synthetic goal',
          currency: 'RON',
          targetMinor: 10000,
          currentMinor: 2500,
          createdAt: 1,
          updatedAt: 1,
        }}
      />,
    );
    const progress = root.findByType(ProgressBar);
    expect(progress.props.accessibilityLabel).toBe('Synthetic goal');
    expect(progress.props.value).toBe(0.25);
    expect(
      root.findAllByType(Text).some((text) => String(text.props.children).includes('25%')),
    ).toBe(true);
  },
);

it('validates accessible goal inputs and persists only on an explicit Save', async () => {
  await i18n.changeLanguage('en');
  const root = await render(<GoalsScreen />);
  const action = (title: string) =>
    root.findAllByType(PlanningButton).find((button) => button.props.title === title)!;
  await act(async () => {
    action(en.planning.addGoal).props.onPress();
  });
  expect(action(en.common.save).props.disabled).toBe(true);
  const input = (label: string) =>
    root.findAllByType(TextInput).find((field) => field.props.accessibilityLabel === label)!;
  await act(async () => {
    input(en.planning.name).props.onChangeText('Synthetic goal');
    input(en.planning.target).props.onChangeText('100');
    input(en.planning.current).props.onChangeText('125');
  });
  expect(action(en.common.save).props.disabled).toBe(false);
  expect(saveGoal).not.toHaveBeenCalled();
  await act(async () => {
    action(en.common.save).props.onPress();
  });
  expect(saveGoal).toHaveBeenCalledWith(
    {},
    {
      name: 'Synthetic goal',
      currency: 'RON',
      targetMinor: 10000,
      currentMinor: 12500,
    },
    undefined,
  );
});

it.each(['en', 'ro'] as const)(
  'labels unknown principal and partial net worth in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    const locale = language === 'en' ? en : ro;
    const root = await render(<NetWorthScreen />);
    const texts = root.findAllByType(Text).map((text) => text.props.children);
    expect(texts).toContain(locale.planning.status.partial);
    expect(texts).toContain(locale.planning.reason.unknownPrincipal);
    expect(texts).toContain(locale.planning.loanEstimate);
  },
);

it('shows query errors instead of a zero total or an indefinite loading message', async () => {
  await i18n.changeLanguage('en');
  mockWorth = { ...mockWorth, loading: true, error: new Error('synthetic failure') };
  const root = await render(<NetWorthScreen />);
  const texts = root.findAllByType(Text).map((text) => text.props.children);
  expect(texts).toContain(en.planning.loadError);
  expect(texts).toContain(en.planning.unavailable);
  expect(texts).not.toContain(en.planning.loading);
});

it('routes both home planning cards to their dedicated screens', async () => {
  await i18n.changeLanguage('en');
  const root = await render(<PlanningCards />);
  await act(async () => {
    root.findAllByType(PlanningButton).forEach((button) => button.props.onPress());
  });
  expect(mockPush.mock.calls).toEqual([['/goals'], ['/net-worth']]);
});
