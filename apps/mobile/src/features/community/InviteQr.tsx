import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';

import { qrPalette, useTheme } from '../../theme';

/** Dark runs per row, so a 25×25 code draws ~150 views instead of 625. */
function qrRuns(value: string) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const size = qr.getModuleCount();
  const rows: { start: number; length: number }[][] = [];
  for (let row = 0; row < size; row += 1) {
    const runs: { start: number; length: number }[] = [];
    let start = -1;
    for (let col = 0; col <= size; col += 1) {
      const dark = col < size && qr.isDark(row, col);
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        runs.push({ start, length: col - start });
        start = -1;
      }
    }
    rows.push(runs);
  }
  return { size, rows };
}

/**
 * Stitch "Convidar membros" QR: a real, scannable code of the invite link (quiet zone included),
 * always dark on light. Decorative for screen readers: the link and the code are shown as text
 * right below it.
 */
export function InviteQr({ value, size = 184 }: { value: string; size?: number }) {
  const theme = useTheme();
  const { size: modules, rows } = useMemo(() => qrRuns(value), [value]);
  const quiet = 2;
  const cell = Math.floor(size / (modules + quiet * 2));
  const side = cell * (modules + quiet * 2);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: side,
        height: side,
        padding: cell * quiet,
        borderRadius: theme.radii.md,
        backgroundColor: qrPalette.light,
      }}
    >
      {rows.map((runs, row) => (
        <View key={row} style={{ height: cell, flexDirection: 'row' }}>
          {runs.map((run) => (
            <View
              key={run.start}
              style={{
                position: 'absolute',
                left: run.start * cell,
                width: run.length * cell,
                height: cell,
                backgroundColor: qrPalette.dark,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
