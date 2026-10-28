import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { checkReceiptSize, ReceiptError } from '../domain/receipt';

export async function checkInterruptedReceipt(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const pending = await ImagePicker.getPendingResultAsync();
    // A recreated form cannot safely infer which unsaved transaction owned the picker.
    if (pending && ('code' in pending || !pending.canceled)) throw new ReceiptError('interrupted');
  } catch (error) {
    if (error instanceof ReceiptError) throw error;
    throw new ReceiptError('importFailed');
  }
}

export async function pickReceipt(source: 'camera' | 'library'): Promise<string | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new ReceiptError('unsupported');
  try {
    if (source === 'camera') {
      const current = await ImagePicker.getCameraPermissionsAsync();
      const permission =
        current.granted || !current.canAskAgain
          ? current
          : await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new ReceiptError('permission');
    }
    // SDK57's system photo picker does not require broad photo-library permission.
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
      exif: false,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (
      !asset?.uri ||
      !/^(file|content):\/\//.test(asset.uri) ||
      (asset.type !== undefined && asset.type !== 'image')
    )
      throw new ReceiptError('importFailed');
    if (asset.fileSize !== undefined) checkReceiptSize(asset.fileSize);
    return asset.uri;
  } catch (error) {
    if (error instanceof ReceiptError) throw error;
    throw new ReceiptError('importFailed');
  }
}
