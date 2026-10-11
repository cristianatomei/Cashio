import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function requestLocalNotificationPermission(
  channelId: string,
  channelName: string,
): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: channelName,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}
