import { Alert } from 'react-native';

type Options = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
};

export function confirmDestructive({ title, message, confirmLabel, cancelLabel, onConfirm }: Options) {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
