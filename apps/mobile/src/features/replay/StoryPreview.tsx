import { useCallback, useEffect, useRef, useState } from 'react';
import { PixelRatio, Platform, View, useWindowDimensions } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import { Button, InlineMessage, Text } from '../../design-system';
import { StoryArt } from '../../design-system/StoryArt';
import { haptics } from '../../lib/haptics';
import {
  getStorySharingAvailability,
  saveStoryImage,
  shareInstagramStory,
  shareStoryImage,
  type StoryShareResult,
} from '../../lib/stories';
import { storyLayout, useTheme, type StoryStyle } from '../../theme';
import { type StoryContent } from './model';
import { storyCaptureGeometry, storyCaptureOptions } from './capture';

const unavailableMessage = (result: StoryShareResult): string => {
  switch (result.reason) {
    case 'app-id':
      return 'A abertura direta no Instagram ainda não está disponível. Use Compartilhar ou salve a imagem para postar nos Stories.';
    case 'instagram':
      return 'O Instagram não está disponível neste aparelho. Você pode salvar a imagem ou compartilhar por outro app.';
    case 'native-module':
      return 'Compartilhar e salvar precisam de uma versão instalada do Bubo com Stories. A prévia continua disponível aqui.';
    case 'permission':
      return 'Permita adicionar fotos nas configurações do celular para salvar a arte. Você também pode usar Compartilhar.';
    case 'android-version':
      return 'Use Compartilhar para salvar a imagem neste aparelho.';
    default:
      return 'Não foi possível preparar a imagem agora. Tente novamente.';
  }
};

/** Mount with a key when content changes: a previous cover must never unlock a new export. */
export function StoryPreview({
  content,
  style,
  onBusy,
}: {
  content: StoryContent;
  style: StoryStyle;
  onBusy?: (busy: boolean) => void;
}) {
  const theme = useTheme();
  const dimensions = useWindowDimensions();
  const width = Math.min(storyLayout.width, dimensions.width - theme.sizes.gutter * 2);
  const geometry = storyCaptureGeometry(PixelRatio.get());
  const scale = width / geometry.sourceWidth;
  const ref = useRef<View>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const [ready, setReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [busy, setBusy] = useState<'instagram' | 'share' | 'save' | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const markReady = useCallback(() => setReady(true), []);
  const availability = getStorySharingAvailability();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onBusy?.(false);
    };
  }, [onBusy]);

  async function exportImage(action: 'instagram' | 'share' | 'save') {
    if (lock.current || !ready || !laidOut || !ref.current) return;
    lock.current = true;
    setBusy(action);
    onBusy?.(true);
    setMessage(null);
    let uri: string | null = null;
    try {
      // Let image/font/layout changes commit before drawing the static capture tree.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (!mounted.current) return;
      uri = await captureRef(ref, storyCaptureOptions(Platform.OS, PixelRatio.get()));
      if (!mounted.current) return;
      const result = await (action === 'instagram'
        ? shareInstagramStory(uri)
        : action === 'save'
          ? saveStoryImage(uri)
          : shareStoryImage(uri));
      if (!mounted.current) return;
      if (result.status === 'saved') {
        haptics.success();
        setMessage({ error: false, text: 'Arte salva nas fotos. Pronta para o seu Story.' });
      } else if (result.status === 'unavailable' || result.status === 'error') {
        haptics.error();
        setMessage({ error: true, text: unavailableMessage(result) });
      }
    } catch {
      if (!mounted.current) return;
      haptics.error();
      setMessage({ error: true, text: 'Não foi possível exportar a arte agora. Tente novamente.' });
    } finally {
      try {
        if (uri) releaseCapture(uri);
      } finally {
        lock.current = false;
        if (mounted.current) {
          setBusy(null);
          onBusy?.(false);
        }
      }
    }
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          width,
          height: (width * 16) / 9,
          alignSelf: 'center',
          borderRadius: theme.radii.lg,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: geometry.sourceWidth,
            height: geometry.sourceHeight,
            transformOrigin: 'top left',
            transform: [{ scale }],
          }}
        >
          <View
            ref={ref}
            collapsable={false}
            onLayout={() => setLaidOut(true)}
            style={{ width: geometry.sourceWidth, height: geometry.sourceHeight }}
          >
            <View
              style={{
                width: storyLayout.width,
                height: storyLayout.height,
                transformOrigin: 'top left',
                transform: [{ scale: geometry.artScale }],
              }}
            >
              <StoryArt content={content} style={style} onReady={markReady} />
            </View>
          </View>
        </View>
      </View>
      <Text variant="bodySm" color="textMuted" align="center" accessibilityLiveRegion="polite">
        {ready ? 'Prévia da arte · imagem 1080 × 1920' : 'Preparando a capa em alta qualidade…'}
      </Text>
      {availability.native ? (
        <>
          <Button
            label="Instagram Stories"
            icon="photo-camera"
            disabled={!ready || !laidOut || busy !== null}
            loading={busy === 'instagram'}
            accessibilityHint="Abre o editor do Instagram com esta arte. Você escolhe quando publicar."
            onPress={() => void exportImage('instagram')}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label="Compartilhar"
              icon="ios-share"
              variant="secondary"
              size="md"
              compact
              style={{ flex: 1 }}
              disabled={!ready || !laidOut || busy !== null}
              loading={busy === 'share'}
              onPress={() => void exportImage('share')}
            />
            <Button
              label="Salvar imagem"
              icon="download"
              variant="secondary"
              size="md"
              compact
              style={{ flex: 1 }}
              disabled={!ready || !laidOut || busy !== null}
              loading={busy === 'save'}
              onPress={() => void exportImage('save')}
            />
          </View>
          {!availability.instagramConfigured ? (
            <Text variant="bodySm" color="textMuted">
              Para postar agora, use Compartilhar ou Salvar imagem. A abertura direta no Instagram
              ficará disponível após a configuração do Bubo.
            </Text>
          ) : null}
        </>
      ) : (
        <InlineMessage
          tone="info"
          message={unavailableMessage({ status: 'unavailable', reason: 'native-module' })}
        />
      )}
      {message ? (
        <InlineMessage tone={message.error ? 'error' : 'success'} message={message.text} />
      ) : null}
    </View>
  );
}
