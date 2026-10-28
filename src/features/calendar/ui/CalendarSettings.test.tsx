import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';

import { en } from '@/core/i18n/locales/en';
import { ro } from '@/core/i18n/locales/ro';
import { AppText, Button, ListRow } from '@/core/ui';
import {
  CALENDAR_STATE_KEY,
  CalendarExportError,
  saveCalendarState,
  syncCalendar,
  writableCalendars,
} from '../data/sync';
import { CalendarSettings } from './CalendarSettings';

let mockSettings: { key: string; value: string }[] = [];
jest.mock('@/core/db', () => ({
  schema: { appSettings: {} },
  useDb: () => ({ select: () => ({ from: () => ({}) }) }),
}));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: () => ({ data: mockSettings }),
}));
jest.mock('../data/sync', () => ({
  ...jest.requireActual('../data/sync'),
  writableCalendars: jest.fn(),
  syncCalendar: jest.fn(),
  saveCalendarState: jest.fn((_db, state) => {
    mockSettings = [{ key: 'calendar_export_v1', value: JSON.stringify(state) }];
  }),
}));
jest.mock('@/core/ui/theme', () => ({
  ...jest.requireActual('@/core/ui/theme/tokens'),
  useTheme: () => ({ colors: jest.requireActual('@/core/ui/theme/palette').lightColors }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'CategoryGlyph');

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: en }, ro: { translation: ro } },
  interpolation: { escapeValue: false },
  initAsync: false,
});
let renderer: ReactTestRenderer;
async function render(language: 'en' | 'ro') {
  await i18n.changeLanguage(language);
  await act(async () => {
    renderer = create(
      <I18nextProvider i18n={i18n}>
        <CalendarSettings />
      </I18nextProvider>,
    );
  });
  return renderer.root;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = [];
  jest
    .mocked(writableCalendars)
    .mockResolvedValue([
      { id: 'chosen', title: 'Synthetic calendar', source: { name: 'Synthetic local source' } },
    ] as Awaited<ReturnType<typeof writableCalendars>>);
  jest.mocked(syncCalendar).mockResolvedValue(2);
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  jest.restoreAllMocks();
});

it.each(['en', 'ro'] as const)(
  'requires consent, exposes a named destination and syncs only on explicit action in %s',
  async (language) => {
    const copy = language === 'en' ? en.calendarExport : ro.calendarExport;
    const root = await render(language);
    const action = (title: string) =>
      root.findAllByType(Button).find((button) => button.props.title === title)!;
    expect(writableCalendars).not.toHaveBeenCalled();
    expect(syncCalendar).not.toHaveBeenCalled();
    expect(root.findAllByType(AppText).some((text) => text.props.children === copy.privacy)).toBe(
      true,
    );
    await act(async () => {
      action(copy.enable).props.onPress();
    });
    expect(writableCalendars).toHaveBeenCalledTimes(1);
    const row = root.findByType(ListRow);
    expect(row.props.accessibilityLabel).toContain('Synthetic calendar · Synthetic local source');
    expect(saveCalendarState).not.toHaveBeenCalled();
    await act(async () => {
      row.props.onPress();
    });
    expect(saveCalendarState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        enabled: true,
        calendarId: 'chosen',
        eventIds: [],
      }),
    );
    expect(syncCalendar).not.toHaveBeenCalled();
    await act(async () => {
      action(copy.sync).props.onPress();
    });
    expect(syncCalendar).toHaveBeenCalledWith(expect.anything(), expect.any(Function), false);
    const announced = root
      .findAllByType(AppText)
      .filter((text) => text.props.accessibilityLiveRegion === 'polite');
    expect(announced.some((text) => String(text.props.children).includes('2'))).toBe(true);
  },
);

it.each(['en', 'ro'] as const)('announces permission errors in %s', async (language) => {
  const copy = language === 'en' ? en.calendarExport : ro.calendarExport;
  jest.mocked(writableCalendars).mockRejectedValueOnce(new CalendarExportError('permission'));
  const root = await render(language);
  await act(async () => {
    root.findByType(Button).props.onPress();
  });
  expect(
    root
      .findAllByType(AppText)
      .some(
        (text) =>
          text.props.accessibilityLiveRegion === 'polite' &&
          text.props.children === copy.permission,
      ),
  ).toBe(true);
  expect(saveCalendarState).not.toHaveBeenCalled();
});

it('confirms destructive cleanup instead of silently removing events', async () => {
  mockSettings = [
    {
      key: CALENDAR_STATE_KEY,
      value: JSON.stringify({
        owner: 'synthetic',
        calendarId: 'chosen',
        calendarTitle: 'Synthetic calendar',
        enabled: true,
        windows: [],
        eventIds: [],
      }),
    },
  ];
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const root = await render('en');
  await act(async () => {
    root
      .findAllByType(Button)
      .find((button) => button.props.title === en.calendarExport.disable)!
      .props.onPress();
  });
  expect(syncCalendar).not.toHaveBeenCalled();
  const confirm = alert.mock.calls[0][2]!.find((button) => button.style === 'destructive')!;
  await act(async () => {
    confirm.onPress!();
  });
  expect(syncCalendar).toHaveBeenCalledWith(expect.anything(), expect.any(Function), true);
});
