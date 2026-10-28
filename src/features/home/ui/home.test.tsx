import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, TextInput, View } from 'react-native';
import { darkColors, lightColors } from '@/core/ui/theme/palette';
import { freeToSpend, parsePayday } from '../domain/freeToSpend';
import { homeCopy } from '../copy';
import { HomeAction } from './HomeAction';
import { HomeSkeleton } from './HomeSkeleton';
import { SpendingCard } from './SpendingCard';
import { LoanLinks } from './LoanLinks';

let mockColors = lightColors;
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('@/core/ui/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: mockColors }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

const now = parsePayday('2026-03-25')!;
const input = {
  now,
  payday: null,
  baseCurrency: 'RON',
  balances: [{ amountMinor: 10000, currency: 'RON' }],
  obligations: [],
  rates: [],
};
const copy = homeCopy('en');
let tree: ReactTestRenderer;

afterEach(() => {
  if (tree) act(() => tree.unmount());
  jest.restoreAllMocks();
});

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('Home in %s theme', (_, colors) => {
  beforeEach(() => {
    mockColors = colors;
  });

  it('uses the theme surface and accessible setup actions at least 48dp high', () => {
    act(() => {
      tree = create(
        <SpendingCard
          result={freeToSpend(input)}
          currency="RON"
          paydayValue=""
          now={now}
          copy={copy}
          onSave={jest.fn()}
        />,
      );
    });
    expect(StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style).backgroundColor).toBe(
      colors.surface,
    );
    const action = tree.root
      .findAllByType(View)
      .find((view) => view.props.accessibilityRole === 'button')!;
    expect(action.props.accessibilityRole).toBe('button');
    expect(action.props.accessibilityLabel).toBe(copy.setPayday);
    expect(StyleSheet.flatten(action.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });

  it('announces loading and uses a static themed skeleton', () => {
    act(() => {
      tree = create(<HomeSkeleton label={copy.loading} />);
    });
    const container = tree.root.findAllByType(View)[0];
    expect(container.props.accessibilityLabel).toBe(copy.loading);
    expect(container.props.accessibilityState).toEqual({ busy: true });
    expect(
      tree.root
        .findAllByType(View)
        .some((view) => StyleSheet.flatten(view.props.style)?.backgroundColor === colors.border),
    ).toBe(true);
  });
});

it('validates payday, persists only explicit dates, and keeps save failures actionable', () => {
  const onSave = jest.fn();
  act(() => {
    tree = create(
      <SpendingCard
        result={freeToSpend(input)}
        currency="RON"
        paydayValue=""
        now={now}
        copy={copy}
        onSave={onSave}
      />,
    );
  });
  act(() => tree.root.findByType(HomeAction).props.onPress());
  const field = tree.root.findByType(TextInput);
  expect(field.props.accessibilityLabel).toBe(copy.payday);
  act(() => field.props.onChangeText('2026-02-31'));
  const save = () =>
    tree.root
      .findAllByType(HomeAction)
      .find((action) => action.props.title === copy.save)!
      .props.onPress();
  act(save);
  expect(onSave).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain(copy.invalidDate);

  act(() => field.props.onChangeText('2026-04-01'));
  onSave.mockImplementationOnce(() => {
    throw new Error('test write failure');
  });
  act(save);
  expect(JSON.stringify(tree.toJSON())).toContain(copy.saveError);
  act(save);
  expect(onSave).toHaveBeenLastCalledWith('2026-04-01');
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
});

it('shows daily spending only with a future payday and makes a deficit explicit', () => {
  const result = freeToSpend({
    ...input,
    payday: parsePayday('2026-04-01'),
    balances: [{ amountMinor: -100, currency: 'RON' }],
  });

  act(() => {
    tree = create(
      <SpendingCard
        result={result}
        currency="RON"
        paydayValue="2026-04-01"
        now={now}
        copy={copy}
        onSave={jest.fn()}
      />,
    );
  });
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain(copy.free);
  expect(rendered).toContain(copy.deficit);
  expect(rendered).not.toContain(copy.setup);
});

it('does not present a partial conversion as a safe daily spending amount', () => {
  const result = freeToSpend({
    ...input,
    payday: parsePayday('2026-04-01'),
    balances: [{ amountMinor: -100, currency: 'EUR' }],
  });
  act(() => {
    tree = create(
      <SpendingCard
        result={result}
        currency="RON"
        paydayValue="2026-04-01"
        now={now}
        copy={copy}
        onSave={jest.fn()}
      />,
    );
  });
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).not.toContain(copy.free);
  expect(rendered).toContain(copy.incomplete);
});

it('provides complete feature copy for both supported languages', () => {
  expect(Object.keys(homeCopy('ro'))).toEqual(Object.keys(copy));
  for (const language of ['ro', 'en']) {
    expect(Object.values(homeCopy(language)).every((value) => value.length > 0)).toBe(true);
  }
});

it('links a duplicate only after explicit user selection and filters unsafe candidates', () => {
  const onLink = jest.fn();
  act(() => {
    tree = create(
      <LoanLinks
        loans={[
          { id: 1, name: 'Mortgage', currency: 'RON', recurringId: null },
          { id: 2, name: 'Other loan', currency: 'RON', recurringId: 3 },
        ]}
        rules={[
          { id: 1, name: 'Mortgage expense', currency: 'RON' },
          { id: 2, name: 'Foreign expense', currency: 'EUR' },
          { id: 3, name: 'Already linked expense', currency: 'RON' },
        ]}
        copy={copy}
        onLink={onLink}
      />,
    );
  });
  const click = (title: string) => {
    act(() =>
      tree.root
        .findAllByType(HomeAction)
        .find((action) => action.props.title === title)!
        .props.onPress(),
    );
  };
  expect(onLink).not.toHaveBeenCalled();
  click(copy.reviewLinks);
  click('Mortgage');
  const titles = tree.root.findAllByType(HomeAction).map((action) => action.props.title);
  expect(titles).toContain('Mortgage expense');
  expect(titles).not.toContain('Foreign expense');
  expect(titles).not.toContain('Already linked expense');
  click('Mortgage expense');
  expect(onLink).toHaveBeenCalledWith(1, 1);
});
