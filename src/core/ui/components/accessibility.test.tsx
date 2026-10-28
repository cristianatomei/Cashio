import type { ReactElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import TabsLayout from '@/app/(tabs)/_layout';
import { AmountKeypad } from '@/features/transactions/ui/AmountKeypad';
import { MonthSwitcher } from '@/features/transactions/ui/MonthSwitcher';
import { NotificationBellButton } from '@/features/capture/ui/NotificationBellButton';
import { en } from '@/core/i18n/locales/en';
import { ro } from '@/core/i18n/locales/ro';

import { darkColors, lightColors } from '../theme/palette';
import { contrastRatio } from '../theme/contrast';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { ColorSwatches } from './ColorSwatches';
import { FormRow } from './FormRow';
import { IconGrid } from './IconGrid';
import { ListRow } from './ListRow';
import { ProgressBar } from './ProgressBar';
import { SectionHeader } from './SectionHeader';
import { SegmentedControl } from './SegmentedControl';
import { SheetModal } from './SheetModal';
import { TextField } from './TextField';
import { SwitchRow } from './SwitchRow';

jest.mock('../theme', () => ({
  ...jest.requireActual('../theme/tokens'),
  ...jest.requireActual('../theme/palette'),
  useTheme: () => ({ colors: mockColors }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'CategoryGlyph');
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  function Tabs(props: { children?: import('react').ReactNode }) {
    return React.createElement('Tabs', props, props.children);
  }
  Tabs.Screen = function TabScreen() {
    return null;
  };
  return { Tabs, useRouter: () => ({ push: jest.fn() }) };
});
jest.mock('@/features/capture/ui/useOpenNotificationCount', () => ({
  useOpenNotificationCount: () => 120,
}));

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: en }, ro: { translation: ro } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

const renderers: ReactTestRenderer[] = [];
let mockColors = lightColors;
// RN 0.86 exports memo(Pressable); the renderer exposes the inner component.
const pressableType = (Pressable as unknown as { type: typeof Pressable }).type ?? Pressable;

beforeEach(async () => {
  jest.useRealTimers();
  mockColors = lightColors;
  await i18n.changeLanguage('en');
});

async function render(element: ReactElement) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>);
  });
  renderers.push(renderer);
  return renderer.root;
}

function layout(node: ReactTestInstance, pressed = false) {
  const { style } = node.props;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed }) : style);
}

afterEach(async () => {
  await act(async () => {
    renderers.splice(0).forEach((renderer) => renderer.unmount());
  });
});

it('gives every shared interactive default real >=48dp bounds, not overlapping hitSlop', async () => {
  const noop = jest.fn();
  const root = await render(
    <View>
      <Button title="Save" onPress={noop} />
      <Chip label="Tag" onPress={noop} />
      <ColorSwatches value="#145DA0" onChange={noop} />
      <FormRow label="Account" onPress={noop} />
      <IconGrid icons={['bank-outline']} value="bank-outline" color="#145DA0" onChange={noop} />
      <ListRow title="Transaction" onPress={noop} />
      <SegmentedControl options={[{ value: 'all', label: 'All' }]} value="all" onChange={noop} />
      <TextField label="Name" />
    </View>,
  );
  const controls = root.findAllByType(pressableType);
  expect(controls).toHaveLength(22);
  for (const control of controls) {
    const style = layout(control);
    expect(style.height ?? style.minHeight).toBeGreaterThanOrEqual(48);
    // Full-width rows use their parent's width; compact controls have explicit minimums.
    if (style.minWidth !== undefined || style.width !== undefined) {
      expect(style.width ?? style.minWidth).toBeGreaterThanOrEqual(48);
    }
    expect(control.props.hitSlop).toBeUndefined();
  }
  expect(layout(root.findByType(TextInput)).minHeight).toBeGreaterThanOrEqual(48);
});

it('retains the button name and announces disabled/busy states when its label is replaced', async () => {
  const onPress = jest.fn();
  const root = await render(<Button title="Save" loading onPress={onPress} variant="secondary" />);
  const button = root.findByType(pressableType);
  expect(button.props.accessibilityRole).toBe('button');
  expect(button.props.accessibilityLabel).toBe('Save');
  expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
  expect(button.props.disabled).toBe(true);
});

it.each([lightColors, darkColors])(
  'preserves AA text even while pressing each button variant',
  async (colors) => {
    mockColors = colors;
    const root = await render(
      <View>
        <Button title="Primary" onPress={jest.fn()} />
        <Button title="Secondary" onPress={jest.fn()} variant="secondary" />
        <Button title="Danger" onPress={jest.fn()} variant="danger" />
      </View>,
    );
    for (const button of root.findAllByType(pressableType)) {
      for (const pressed of [false, true]) {
        const style = layout(button, pressed);
        expect(style.opacity).toBe(1);
        expect(
          contrastRatio(layout(button.findByType(Text)).color, style.backgroundColor),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  },
);

it('announces selection and preserves callbacks for chips, radio segments, colors and icons', async () => {
  const onChange = jest.fn();
  const root = await render(
    <View>
      <Chip label="Food" selected onPress={onChange} />
      <SegmentedControl
        value="all"
        options={[
          { value: 'all', label: 'All' },
          { value: 'some', label: 'Some' },
        ]}
        onChange={onChange}
      />
      <ColorSwatches value="#145da0" onChange={onChange} />
      <IconGrid icons={['bank-outline']} value="bank-outline" color="#145DA0" onChange={onChange} />
    </View>,
  );
  const controls = root.findAllByType(pressableType);
  expect(controls[0].props.accessibilityState).toEqual({ selected: true });
  expect(controls[1].props.accessibilityState).toEqual({ checked: true });
  expect(controls[2].props.accessibilityState).toEqual({ checked: false });
  expect(controls[3].props.accessibilityState).toEqual({ checked: true });
  expect(controls[3].props.accessibilityLabel).toBe('Color: Ocean blue');
  const icon = controls[controls.length - 1];
  expect(icon.props.accessibilityLabel).toBe('Icon: Bank');
  expect(icon.props.accessibilityState).toEqual({ checked: true });
  await act(async () => {
    controls[2].props.onPress();
    controls[3].props.onPress();
    icon.props.onPress();
  });
  expect(onChange.mock.calls).toEqual([['some'], ['#145DA0'], ['bank-outline']]);
});

it('does not turn static rows into focusable buttons or swallow trailing text/controls', async () => {
  const root = await render(
    <View>
      <ListRow title="Balance" trailing={<AppText>123 RON</AppText>} />
      <ListRow title="Open account" onPress={jest.fn()} trailing={<AppText>456 RON</AppText>} />
      <FormRow label="Bank" value="Account" onPress={jest.fn()} />
      <SectionHeader title="Accounts" />
    </View>,
  );
  const rows = root.findAllByType(pressableType);
  expect(rows[0].props.accessible).toBe(false);
  expect(rows[0].props.accessibilityRole).toBeUndefined();
  expect(rows[1].props.accessibilityRole).toBe('button');
  // No explicit label: RN includes title, subtitle AND trailing financial amount.
  expect(rows[1].props.accessibilityLabel).toBeUndefined();
  expect(rows[2].props.accessibilityLabel).toBe('Bank, Account');
  expect(root.findAllByType(Text).some((text) => text.props.accessibilityRole === 'header')).toBe(
    true,
  );
});

it('hides decorative trailing font glyphs without hiding trailing financial text', async () => {
  const root = await render(
    <View>
      <ListRow title="Open" trailing={<Ionicons name="chevron-forward" />} onPress={jest.fn()} />
      <ListRow title="Balance" trailing={<AppText>123 RON</AppText>} onPress={jest.fn()} />
    </View>,
  );
  const rows = root.findAllByType(pressableType);
  const trailing = (row: ReactTestInstance) =>
    row.findAllByType(View).find((view) => layout(view)?.maxWidth === '100%');
  expect(trailing(rows[0])?.props.accessibilityElementsHidden).toBe(true);
  expect(trailing(rows[1])?.props.accessibilityElementsHidden).toBe(false);
  expect(layout(rows[1]).flexWrap).toBe('wrap');
});

it('keeps text and input scaling enabled, preserves caller caps, and avoids fixed text heights', async () => {
  const root = await render(
    <View>
      <AppText>Long Romanian or English text</AppText>
      <AppText maxFontSizeMultiplier={2.5}>Caller-specific cap</AppText>
      <Button title="A very long localized button label" onPress={jest.fn()} />
      <Chip label="A very long localized chip label" onPress={jest.fn()} />
      <TextField label="Account name" maxFontSizeMultiplier={3} />
    </View>,
  );
  const texts = root.findAllByType(Text);
  expect(texts.every((text) => text.props.allowFontScaling === true)).toBe(true);
  expect(texts[0].props.maxFontSizeMultiplier).toBeUndefined();
  expect(texts[1].props.maxFontSizeMultiplier).toBe(2.5);
  expect(texts.every((text) => text.props.numberOfLines === undefined)).toBe(true);
  expect(texts.every((text) => layout(text).height === undefined)).toBe(true);
  const input = root.findByType(TextInput);
  expect(input.props.allowFontScaling).toBe(true);
  expect(input.props.maxFontSizeMultiplier).toBe(3);
  expect(input.props.accessibilityLabel).toBe('Account name');
  expect(layout(input).height).toBeUndefined();
});

it('allows explicit input labels and text scaling options without breaking existing API', async () => {
  const root = await render(
    <View>
      <TextField label="Amount" accessibilityLabel="Amount in RON" allowFontScaling={false} />
      <TextField placeholder="Search transactions" />
    </View>,
  );
  const inputs = root.findAllByType(TextInput);
  expect(inputs[0].props.accessibilityLabel).toBe('Amount in RON');
  expect(inputs[0].props.allowFontScaling).toBe(false);
  expect(inputs[1].props.accessibilityLabel).toBe('Search transactions');
});

it('gives switches one labeled 48dp target with checked/disabled state and one callback', async () => {
  const onValueChange = jest.fn();
  const root = await render(
    <View>
      <SwitchRow
        label="Reminders"
        description="Before the due date"
        value
        onValueChange={onValueChange}
      />
      <SwitchRow label="Rollover" value={false} disabled onValueChange={onValueChange} />
    </View>,
  );
  const switches = root.findAllByType(pressableType);
  expect(switches[0].props.accessibilityRole).toBe('switch');
  expect(switches[0].props.accessibilityLabel).toBe('Reminders');
  expect(switches[0].props.accessibilityHint).toBe('Before the due date');
  expect(switches[0].props.accessibilityState).toEqual({ checked: true, disabled: false });
  expect(layout(switches[0]).minHeight).toBe(48);
  expect(switches[1].props.disabled).toBe(true);
  expect(switches[1].props.accessibilityState).toEqual({ checked: false, disabled: true });
  await act(async () => {
    switches[0].props.onPress();
  });
  expect(onValueChange.mock.calls).toEqual([[false]]);
});

it.each(['en', 'ro'])(
  'labels keypad operators, delete and non-gesture clear in %s',
  async (lng) => {
    await i18n.changeLanguage(lng);
    const onChange = jest.fn();
    const root = await render(<AmountKeypad expression="12" onChange={onChange} />);
    const keys = root.findAllByType(pressableType);
    expect(keys).toHaveLength(16);
    expect(keys[3].props.accessibilityLabel).toBe(lng === 'en' ? 'Divide' : 'Împarte');
    const backspace = keys[14];
    expect(backspace.props.accessibilityLabel).toBe(
      lng === 'en' ? 'Delete last digit' : 'Șterge ultima cifră',
    );
    expect(backspace.props.accessibilityActions).toEqual([
      { name: 'clear', label: lng === 'en' ? 'Clear amount' : 'Golește suma' },
    ]);
    for (const key of keys) {
      expect(key.props.accessibilityRole).toBe('button');
      expect(layout(key).minHeight).toBeGreaterThanOrEqual(48);
      expect(layout(key).minWidth).toBeGreaterThanOrEqual(48);
      expect(layout(key).height).toBeUndefined();
    }
    await act(async () => {
      backspace.props.onAccessibilityAction({ nativeEvent: { actionName: 'clear' } });
    });
    expect(onChange).toHaveBeenCalledWith('');
  },
);

it('gives month navigation and notification bell actual 48dp named targets', async () => {
  const root = await render(
    <View>
      <MonthSwitcher monthStart={new Date(2026, 9, 1).getTime()} onChange={jest.fn()} />
      <NotificationBellButton />
    </View>,
  );
  const controls = root.findAllByType(pressableType);
  expect(controls[0].props.accessibilityLabel).toBe('Previous month');
  expect(controls[1].props.accessibilityLabel).toBe('Next month');
  expect(controls[2].props.accessibilityLabel).toContain('120');
  for (const control of controls) {
    expect(layout(control).minHeight).toBeGreaterThanOrEqual(48);
    expect(layout(control).minWidth).toBeGreaterThanOrEqual(48);
  }
});

it('grows bottom navigation from measured wrapped labels instead of capping or shrinking fonts', async () => {
  const root = await render(<TabsLayout />);
  const options = root.findByType(Tabs).props.screenOptions;
  expect(options.tabBarAllowFontScaling).toBe(true);
  expect(options.tabBarItemStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(options.tabBarStyle.height).toBeGreaterThanOrEqual(64);
  const labelRoot = await render(options.tabBarLabel({ children: 'Tranzacții', color: '#10131A' }));
  const label = labelRoot.findByType(Text);
  expect(label.props.allowFontScaling).toBe(true);
  expect(label.props.numberOfLines).toBeUndefined();
  await act(async () => {
    label.props.onLayout({ nativeEvent: { layout: { height: 80 } } });
  });
  expect(root.findByType(Tabs).props.screenOptions.tabBarStyle.height).toBe(124);
});

it.each(['en', 'ro'])(
  'labels sheet close and progress in %s without focusing the backdrop',
  async (lng) => {
    await act(async () => {
      await i18n.changeLanguage(lng);
    });
    const onClose = jest.fn();
    const root = await render(
      <SheetModal visible title="Title" onClose={onClose}>
        <ProgressBar value={1.25} />
      </SheetModal>,
    );
    const controls = root.findAllByType(pressableType);
    expect(controls[0].props.accessible).toBe(false);
    expect(controls[1].props.accessibilityLabel).toBe(lng === 'en' ? 'Close' : 'Închide');
    expect(layout(controls[1]).minWidth).toBe(48);
    expect(layout(controls[1]).minHeight).toBe(48);
    const progress = root
      .findAllByType(View)
      .find((view) => view.props.accessibilityRole === 'progressbar');
    expect(progress?.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 100,
      text: lng === 'en' ? '125 percent' : '125 la sută',
    });
    await act(async () => {
      controls[1].props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  },
);
