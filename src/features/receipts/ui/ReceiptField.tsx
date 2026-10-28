import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image } from 'react-native';

import { AppText, Button, Card, SheetModal } from '@/core/ui';

import { receiptUri } from '../data/files';
import { checkInterruptedReceipt, pickReceipt } from '../data/picker';
import { ReceiptError } from '../domain/receipt';

export type ReceiptDraft = { filename: string } | { uri: string } | null;

export function ReceiptField({
  value,
  onChange,
  onBusy,
}: {
  value: ReceiptDraft;
  onChange: (value: ReceiptDraft) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void checkInterruptedReceipt().catch((cause: unknown) => {
      if (active) {
        Alert.alert(
          t('receipts.title'),
          t(`receipts.${cause instanceof ReceiptError ? cause.code : 'importFailed'}`),
        );
      }
    });
    return () => {
      active = false;
    };
  }, [t]);
  const error = (cause: unknown) =>
    Alert.alert(
      t('receipts.title'),
      t(`receipts.${cause instanceof ReceiptError ? cause.code : 'importFailed'}`),
    );
  const choose = async (source: 'camera' | 'library') => {
    setBusy(true);
    onBusy(true);
    try {
      const uri = await pickReceipt(source);
      if (uri) onChange({ uri });
    } catch (cause) {
      error(cause);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  return (
    <Card>
      <AppText variant="heading">{t('receipts.title')}</AppText>
      <AppText>{t('receipts.hint')}</AppText>
      {value ? (
        <>
          <Button
            title={t('receipts.view')}
            disabled={busy}
            onPress={() => {
              try {
                setPreview('filename' in value ? receiptUri(value.filename) : value.uri);
              } catch (cause) {
                error(cause);
              }
            }}
          />
          <Button
            title={t('receipts.remove')}
            variant="danger"
            disabled={busy}
            onPress={() => onChange(null)}
          />
        </>
      ) : null}
      <Button
        title={t('receipts.library')}
        disabled={busy}
        onPress={() => void choose('library')}
      />
      <Button title={t('receipts.camera')} disabled={busy} onPress={() => void choose('camera')} />
      <SheetModal
        visible={preview !== null}
        title={t('receipts.title')}
        onClose={() => setPreview(null)}
      >
        {preview ? (
          <Image
            source={{ uri: preview }}
            accessibilityLabel={t('receipts.title')}
            resizeMode="contain"
            style={{ width: '100%', height: 440 }}
            onError={() => {
              setPreview(null);
              error(new ReceiptError('missing'));
            }}
          />
        ) : null}
      </SheetModal>
    </Card>
  );
}
