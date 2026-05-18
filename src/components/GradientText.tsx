import React from 'react';
import { Text, TextStyle } from 'react-native';
import { Colors } from './theme';

interface Props {
  text: string;
  /** Ignored — kept for prop compatibility with previous gradient implementation. */
  stops?: string[];
  style?: TextStyle | TextStyle[];
}

/** Plain text rendered in primary text color. Gradient effect intentionally removed. */
export function GradientText({ text, style }: Props) {
  return <Text style={[style, { color: Colors.textPrimary }]}>{text}</Text>;
}
