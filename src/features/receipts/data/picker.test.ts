import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { checkInterruptedReceipt, pickReceipt } from './picker';
import { MAX_RECEIPT_BYTES } from '../domain/receipt';

jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  getPendingResultAsync: jest.fn(),
}));

const camera = jest.mocked(ImagePicker.getCameraPermissionsAsync);
const request = jest.mocked(ImagePicker.requestCameraPermissionsAsync);
const launchCamera = jest.mocked(ImagePicker.launchCameraAsync);
const launchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync);
const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' } as const;
const denied = { ...granted, status: 'denied', granted: false } as const;
const picked = {
  canceled: false,
  assets: [{ uri: 'file:///photo.jpg', width: 10, height: 10, type: 'image' }],
} as const;

beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  camera.mockResolvedValue(granted as ImagePicker.CameraPermissionResponse);
  launchCamera.mockResolvedValue(picked as unknown as ImagePicker.ImagePickerResult);
  launchLibrary.mockResolvedValue(picked as unknown as ImagePicker.ImagePickerResult);
});

it('opens the system image library without requesting camera or broad library access', async () => {
  await expect(pickReceipt('library')).resolves.toBe('file:///photo.jpg');
  expect(camera).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  expect(launchLibrary).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaTypes: ['images'],
      exif: false,
      allowsMultipleSelection: false,
    }),
  );
});

it('requests camera permission only on camera action, and handles denial', async () => {
  camera.mockResolvedValue(denied as ImagePicker.CameraPermissionResponse);
  request.mockResolvedValue(denied as ImagePicker.CameraPermissionResponse);
  await expect(pickReceipt('camera')).rejects.toThrow('permission');
  expect(request).toHaveBeenCalledTimes(1);
  expect(launchCamera).not.toHaveBeenCalled();
  camera.mockResolvedValue({
    ...denied,
    canAskAgain: false,
  } as ImagePicker.CameraPermissionResponse);
  await expect(pickReceipt('camera')).rejects.toThrow('permission');
  expect(request).toHaveBeenCalledTimes(1);
});

it('uses granted camera access, treats cancel as no change, and reports picker/size errors', async () => {
  await expect(pickReceipt('camera')).resolves.toBe('file:///photo.jpg');
  expect(request).not.toHaveBeenCalled();
  launchLibrary.mockResolvedValue({ canceled: true, assets: null });
  await expect(pickReceipt('library')).resolves.toBeNull();
  launchLibrary.mockRejectedValue(new Error('Picker unavailable'));
  await expect(pickReceipt('library')).rejects.toThrow('importFailed');
  launchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ ...picked.assets[0], fileSize: MAX_RECEIPT_BYTES + 1 }],
  });
  await expect(pickReceipt('library')).rejects.toThrow('tooLarge');
});

it('opens the camera after a newly granted permission and rejects unsupported platforms', async () => {
  camera.mockResolvedValue(denied as ImagePicker.CameraPermissionResponse);
  request.mockResolvedValue(granted as ImagePicker.CameraPermissionResponse);
  await expect(pickReceipt('camera')).resolves.toBe('file:///photo.jpg');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  await expect(pickReceipt('library')).rejects.toThrow('unsupported');
});

it('reports Android picker activity loss without auto-attaching to a different form', async () => {
  jest
    .mocked(ImagePicker.getPendingResultAsync)
    .mockResolvedValue(picked as unknown as ImagePicker.ImagePickerResult);
  await expect(checkInterruptedReceipt()).rejects.toThrow('interrupted');
  jest
    .mocked(ImagePicker.getPendingResultAsync)
    .mockResolvedValue({ canceled: true, assets: null });
  await expect(checkInterruptedReceipt()).resolves.toBeUndefined();
  jest.mocked(ImagePicker.getPendingResultAsync).mockResolvedValue(null);
  await expect(checkInterruptedReceipt()).resolves.toBeUndefined();
});

it('rejects remote image URIs before they can reach the preview or storage', async () => {
  launchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ ...picked.assets[0], uri: 'https://invalid.test/image.jpg' }],
  });
  await expect(pickReceipt('library')).rejects.toThrow('importFailed');
});
