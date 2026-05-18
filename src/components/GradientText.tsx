import React from 'react';
import { Text, View, StyleSheet, TextStyle } from 'react-native';

interface Props {
  text: string;
  /** Color stops to interpolate across — at least 2. */
  stops?: string[];
  style?: TextStyle | TextStyle[];
}

function lerpHex(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function gradientAt(f: number, stops: string[]): string {
  const segments = stops.length - 1;
  const seg = Math.min(segments - 1, Math.floor(f * segments));
  const local = f * segments - seg;
  return lerpHex(stops[seg], stops[seg + 1], local);
}

/** Per-character color interpolation across a multi-stop gradient.
 *  Whitespace is preserved as a fixed-width spacer instead of a colored glyph. */
export function GradientText({ text, stops = ['#7B2FFF', '#00D4FF', '#A855F7'], style }: Props) {
  const chars = text.split('');
  const colorIndices = chars
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch }) => ch !== ' ');
  const last = colorIndices.length - 1;

  return (
    <View style={styles.row}>
      {chars.map((ch, i) => {
        if (ch === ' ') return <View key={i} style={styles.spacer} />;
        const colorIdx = colorIndices.findIndex((c) => c.i === i);
        const color = gradientAt(last === 0 ? 0 : colorIdx / last, stops);
        return (
          <Text key={i} style={[style, { color }]}>
            {ch}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  spacer: { width: 8 },
});
