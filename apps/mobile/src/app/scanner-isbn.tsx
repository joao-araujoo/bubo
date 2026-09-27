import { type CatalogBook } from '@bubo/contracts';
import { toIsbn13 } from '@bubo/domain';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BookCover,
  BuboMascot,
  Button,
  Chip,
  Icon,
  InlineMessage,
  Text,
  TextField,
} from '../design-system';
import { authorLine, catalogErrorMessage, scannerPick } from '../features/catalog/catalog';
import { useAddFromCatalog, useShelfLookup } from '../features/catalog/useAddFromCatalog';
import { ApiError } from '../lib/api/client';
import { useIsbnLookup } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { darkColors, useTheme } from '../theme';

function formatIsbn(isbn: string) {
  return `${isbn.slice(0, 3)}-${isbn.slice(3, 5)}-${isbn.slice(5, 9)}-${isbn.slice(9, 12)}-${isbn.slice(12)}`;
}

/** Round, dark "glass" button of the scanner chrome (back, torch). */
function ChromeButton({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: 'arrow-back' | 'flash-on' | 'flash-off';
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={() => {
        haptics.press();
        onPress();
      }}
      style={{
        width: theme.sizes.touchTarget,
        height: theme.sizes.touchTarget,
        borderRadius: theme.radii.pill,
        borderWidth: theme.sizes.borderWidth,
        borderColor: darkColors.border,
        backgroundColor: active ? darkColors.primary : darkColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={22} color="onPrimary" />
    </Pressable>
  );
}

/** Purple corner brackets around the scan window (Stitch scanner). */
function Frame() {
  const theme = useTheme();
  const corner = {
    position: 'absolute' as const,
    width: 36,
    height: 36,
    borderColor: theme.colors.primary,
  };
  return (
    <View
      pointerEvents="none"
      style={{
        width: 300,
        height: 190,
        borderRadius: theme.radii.card,
        borderWidth: theme.sizes.borderWidth,
        borderColor: darkColors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={[
          corner,
          { top: 10, left: 10, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
        ]}
      />
      <View
        style={[
          corner,
          { top: 10, right: 10, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
        ]}
      />
      <View
        style={[
          corner,
          {
            bottom: 10,
            left: 10,
            borderBottomWidth: 4,
            borderLeftWidth: 4,
            borderBottomLeftRadius: 12,
          },
        ]}
      />
      <View
        style={[
          corner,
          {
            bottom: 10,
            right: 10,
            borderBottomWidth: 4,
            borderRightWidth: 4,
            borderBottomRightRadius: 12,
          },
        ]}
      />
      <View
        style={{
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: darkColors.textMuted,
        }}
      >
        <Icon name="qr-code-scanner" size={24} color="onPrimary" />
        <Text variant="bodySm" color="onPrimary">
          Alinhe o código de barras (ISBN)
        </Text>
      </View>
    </View>
  );
}

type SheetProps = {
  isbn: string;
  book: CatalogBook | undefined;
  loading: boolean;
  error: unknown;
  pick: boolean;
  onRetry: () => void;
  onRescan: () => void;
};

/** White result sheet: "Livro identificado", cover, facts and the actions. */
function ResultSheet({ isbn, book, loading, error, pick, onRetry, onRescan }: SheetProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuthState();
  const userId = auth.status === 'ready' || auth.status === 'needs_onboarding' ? auth.userId : '';
  const { addToShelf, pendingId } = useAddFromCatalog(userId, 'replace');
  const entryFor = useShelfLookup(userId);
  const entryId = book ? entryFor(book) : null;
  const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';
  const author = book ? authorLine(book) : null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        margin: theme.sizes.gutter,
        marginBottom: insets.bottom + theme.spacing.md,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        borderRadius: theme.radii.card,
        backgroundColor: theme.colors.surface,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.borderSoft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {book ? (
          <Chip label="Livro identificado" tone="success" icon="verified" />
        ) : (
          <Chip label={loading ? 'Procurando…' : 'Código lido'} tone="neutral" />
        )}
        <Text variant="bodySm" color="textMuted">
          ISBN {formatIsbn(isbn)}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Buscando o livro" />
      ) : book ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <BookCover title={book.title} author={author} coverUrls={book.coverUrls} width={64} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="title" numberOfLines={2}>
              {book.title}
            </Text>
            <Text variant="bodySm" color="textMuted" numberOfLines={1}>
              {[author, book.publisher].filter(Boolean).join(' · ') || 'Autor desconhecido'}
            </Text>
            {book.totalPages ? <Chip label={`${book.totalPages} páginas`} tone="primary" /> : null}
          </View>
        </View>
      ) : (
        <InlineMessage
          tone={notFound ? 'info' : 'error'}
          message={
            notFound
              ? 'Não encontramos esse ISBN nas bibliotecas. Você pode adicionar o livro manualmente.'
              : catalogErrorMessage(error)
          }
        />
      )}

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          label={book || notFound ? 'Manual' : 'Ler de novo'}
          icon={book || notFound ? 'edit-note' : 'qr-code-scanner'}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => {
            if (book || notFound) {
              if (pick) router.back();
              else router.replace('/adicionar-livro?manual=1');
            } else onRescan();
          }}
        />
        {book ? (
          entryId && !pick ? (
            <Button
              label="Abrir"
              icon="menu-book"
              style={{ flex: 1 }}
              onPress={() => router.replace({ pathname: '/livro/[id]', params: { id: entryId } })}
            />
          ) : (
            <Button
              label={pick ? 'Usar este' : 'Adicionar'}
              icon={pick ? 'check' : 'bookmark-add'}
              style={{ flex: 1 }}
              loading={pendingId !== null}
              onPress={() => {
                if (pick) {
                  haptics.success();
                  scannerPick.set(book);
                  router.back();
                } else void addToShelf(book, 'want_to_read');
              }}
            />
          )
        ) : !loading && !notFound ? (
          <Button label="Tentar de novo" icon="refresh" style={{ flex: 1 }} onPress={onRetry} />
        ) : (
          <Button
            label="Ler outro"
            icon="qr-code-scanner"
            style={{ flex: 1 }}
            disabled={loading}
            onPress={onRescan}
          />
        )}
      </View>
    </View>
  );
}

/** Typed-in ISBN, for when the camera is unavailable or not allowed. */
function ManualIsbn({ onSubmit }: { onSubmit: (isbn: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const isbn = toIsbn13(value);
    if (!isbn) {
      setError('Digite um ISBN válido (10 ou 13 dígitos).');
      haptics.warning();
      return;
    }
    setError(null);
    onSubmit(isbn);
  };
  return (
    <>
      <TextField
        label="Digitar ISBN"
        icon="numbers"
        placeholder="978-85-7657-313-5"
        keyboardType="number-pad"
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        error={error}
      />
      <Button label="Buscar ISBN" icon="search" variant="secondary" fullWidth onPress={submit} />
    </>
  );
}

/** ISBN scanner (expo-camera): EAN-13 barcodes → catalog lookup → add or pick. */
export default function IsbnScannerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const pick = mode === 'pick';
  const auth = useAuthState();
  const userId = auth.status === 'ready' || auth.status === 'needs_onboarding' ? auth.userId : '';
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [isbn, setIsbn] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const lastInvalid = useRef('');
  const lookup = useIsbnLookup(userId, isbn);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const scanned = toIsbn13(data);
    if (!scanned) {
      // Price or store barcodes (not 978/979): tell once, keep scanning.
      if (lastInvalid.current !== data) {
        lastInvalid.current = data;
        haptics.warning();
        setInvalid(true);
      }
      return;
    }
    haptics.success();
    setInvalid(false);
    setIsbn(scanned);
  };

  const rescan = () => {
    lastInvalid.current = '';
    setIsbn(null);
  };

  const granted = permission?.granted === true;

  return (
    <View style={{ flex: 1, backgroundColor: darkColors.bg }}>
      {granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
          onBarcodeScanned={isbn ? undefined : onScanned}
          accessibilityLabel="Visor da câmera"
        />
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.sizes.gutter,
        }}
      >
        <ChromeButton icon="arrow-back" label="Voltar" onPress={() => router.back()} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            minHeight: 40,
            borderRadius: theme.radii.pill,
            borderWidth: 1,
            borderColor: darkColors.border,
            backgroundColor: darkColors.scrim,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: granted ? theme.colors.success : darkColors.textMuted,
            }}
          />
          <Text variant="label" color="onPrimary">
            {granted ? 'SCANNER ISBN ATIVO' : 'SCANNER ISBN'}
          </Text>
        </View>
        {granted ? (
          <ChromeButton
            icon={torch ? 'flash-on' : 'flash-off'}
            label={torch ? 'Desligar lanterna' : 'Ligar lanterna'}
            active={torch}
            onPress={() => setTorch((value) => !value)}
          />
        ) : (
          <View style={{ width: theme.sizes.touchTarget }} />
        )}
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.lg,
          paddingHorizontal: theme.sizes.gutter,
        }}
      >
        {!permission ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : granted ? (
          isbn ? null : (
            <>
              <Frame />
              <View
                style={{
                  maxWidth: 320,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.lg,
                  borderRadius: theme.radii.lg,
                  backgroundColor: darkColors.scrim,
                }}
              >
                <Text variant="bodySm" color="onPrimary" align="center">
                  {invalid
                    ? 'Esse código não é um ISBN. Procure o código que começa com 978 ou 979.'
                    : 'Aponte para a contracapa do livro. O Bubo reconhece a edição automaticamente.'}
                </Text>
              </View>
            </>
          )
        ) : (
          <View
            style={{
              alignSelf: 'stretch',
              gap: theme.spacing.md,
              padding: theme.spacing.lg,
              borderRadius: theme.radii.card,
              backgroundColor: theme.colors.surface,
            }}
          >
            <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <BuboMascot state="recallPrompt" size={96} />
              <Text variant="title" align="center">
                Precisamos da câmera
              </Text>
              <Text variant="body" color="textMuted" align="center">
                Ela é usada só para ler o código de barras. Nada é gravado ou enviado.
              </Text>
            </View>
            {permission.canAskAgain ? (
              <Button
                label="Permitir câmera"
                icon="photo-camera"
                fullWidth
                onPress={() => void requestPermission()}
              />
            ) : (
              <Button
                label="Abrir ajustes"
                icon="settings"
                fullWidth
                onPress={() => void Linking.openSettings()}
              />
            )}
            {isbn ? null : <ManualIsbn onSubmit={setIsbn} />}
          </View>
        )}
      </View>

      {isbn ? (
        <ResultSheet
          isbn={isbn}
          book={lookup.data?.book}
          loading={lookup.isPending}
          error={lookup.error}
          pick={pick}
          onRetry={() => void lookup.refetch()}
          onRescan={rescan}
        />
      ) : null}
    </View>
  );
}
