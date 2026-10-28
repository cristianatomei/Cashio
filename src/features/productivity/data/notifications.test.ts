import {
  applyCaptureCategory,
  notifyNewCaptures,
  setCaptureNotificationsEnabled,
} from './notifications';
import * as Notifications from 'expo-notifications';
import type { AppDb } from '@/core/db';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
}));
jest.mock('@/core/notifications', () => ({ requestLocalNotificationPermission: jest.fn() }));
jest.mock('@/core/i18n', () => ({ i18next: { t: (key: string) => key } }));
jest.mock('@/core/db', () => ({ schema: jest.requireActual('@/core/db/schema') }));
jest.mock('@/features/app-lock/data/settings', () => ({
  loadAppLockSettings: () => ({ enabled: true }),
}));

function fakeDb(results: unknown[]) {
  const queue = [...results];
  const builder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(() => queue.shift()),
    all: jest.fn(() => queue.shift()),
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    run: jest.fn(),
  };
  return {
    db: {
      select: () => builder,
      insert: () => builder,
      update: jest.fn(() => builder),
    } as unknown as AppDb,
    builder,
  };
}

beforeEach(() => jest.clearAllMocks());

it('does not request permissions or send anything when capture notifications are disabled by default', async () => {
  const { db } = fakeDb([undefined]);
  await notifyNewCaptures(db, 0);
  expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('preserves reminders when disabling notifications', async () => {
  jest
    .mocked(Notifications.getPresentedNotificationsAsync)
    .mockResolvedValue([
      { request: { identifier: 'capture', content: { data: { kind: 'cashio_capture' } } } },
      { request: { identifier: 'loan', content: { data: { kind: 'loan_schedule_reminder' } } } },
    ] as never);
  await setCaptureNotificationsEnabled(fakeDb([]).db, false);
  expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('capture');
});

it('redacts amounts and category buttons when app lock is enabled', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([]);
  jest.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValue([]);
  const { db } = fakeDb([{ value: 'true' }, [{ id: 42, amountMinor: 12345 }], undefined]);
  await notifyNewCaptures(db, 41);
  expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('cashio_capture', [
    expect.objectContaining({ identifier: 'open' }),
  ]);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        body: 'productivity.capturedBody',
        data: { kind: 'cashio_capture', transactionId: 42 },
      }),
    }),
  );
});

it('persists an explicit failure without rejecting successful capture', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as never);
  const { db, builder } = fakeDb([{ value: 'true' }, [{ id: 42 }]]);
  await expect(notifyNewCaptures(db, 41)).resolves.toBeUndefined();
  expect(builder.values).toHaveBeenCalledWith({
    key: 'capture_notification_error',
    value: 'delivery',
  });
  log.mockRestore();
});

it('updates only category and timestamp, preserving captured draft review status', () => {
  const { db, builder } = fakeDb([
    { source: 'notification', type: 'expense', status: 'draft' },
    { id: 3 },
    undefined,
  ]);
  expect(applyCaptureCategory(db, 42, 'category:3')).toBe(true);
  expect(builder.set).toHaveBeenCalledWith({ categoryId: 3, updatedAt: expect.any(Number) });
});

it.each([
  [null, { id: 3 }, undefined],
  [{ source: 'manual', type: 'expense' }, { id: 3 }, undefined],
  [{ source: 'notification', type: 'income' }, { id: 3 }, undefined],
  [{ source: 'notification', type: 'expense' }, undefined, undefined],
  [{ source: 'notification', type: 'expense' }, { id: 3 }, { amountMinor: 42 }],
])('rejects stale, unsupported or split transaction actions', (...results) => {
  const { db } = fakeDb(results);
  expect(applyCaptureCategory(db, 42, 'category:3')).toBe(false);
  expect(db.update).not.toHaveBeenCalled();
});
