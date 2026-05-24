import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Typography } from './theme';

interface Props {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;

  /** Styles confirm button red and title red. For Delete / Remove / Hide / Archive. */
  destructive?: boolean;

  /** Styles confirm button amber and adds amber border accent on the sheet. For sensitive
   *  reveal flows like "view recovery phrase" / "view private key". */
  warning?: boolean;

  /** When true, renders a checkbox row with `checkLabel` text. Confirm button stays
   *  disabled until the user taps the checkbox. Used for the highest-stakes flows
   *  (Delete wallet) where a single tap isn't enough friction. */
  checkConfirm?: boolean;
  checkLabel?: string;

  onConfirm: () => void;
  onCancel: () => void;

  /** When true (default), tapping the dimmed backdrop calls onCancel.
   *  Set false for sensitive flows where accidental dismissal is a problem
   *  (e.g. Delete wallet — user must make an explicit Cancel vs Delete choice). */
  dismissOnBackdrop?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  warning = false,
  checkConfirm = false,
  checkLabel,
  onConfirm,
  onCancel,
  dismissOnBackdrop = true,
}: Props) {
  const [checked, setChecked] = React.useState(false);

  // Reset checkbox state every time the modal closes so a re-open
  // doesn't preserve a previous tick.
  React.useEffect(() => {
    if (!visible) setChecked(false);
  }, [visible]);

  const confirmDisabled = checkConfirm && !checked;
  const confirmBg = destructive ? Colors.error : warning ? Colors.warning : Colors.primary;
  const titleColor = destructive ? Colors.error : Colors.textPrimary;

  // Warning tone adds a thicker amber border on the sheet to draw the eye —
  // signals "pay attention" without the alarm of a destructive (red) title.
  const sheetBorderColor = warning ? Colors.warning + '50' : Colors.border;
  const sheetBorderWidth = warning ? 1.5 : 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        onPress={dismissOnBackdrop ? onCancel : undefined}
      >
        <Pressable
          style={[
            styles.sheet,
            { borderColor: sheetBorderColor, borderWidth: sheetBorderWidth },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[Typography.h3, { marginBottom: 8, color: titleColor }]}>
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>

          {checkConfirm && checkLabel && (
            <Pressable
              style={styles.checkRow}
              onPress={() => setChecked((v) => !v)}
              hitSlop={6}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.checkText}>{checkLabel}</Text>
            </Pressable>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: confirmBg, borderColor: confirmBg },
                confirmDisabled && { opacity: 0.4 },
              ]}
              onPress={confirmDisabled ? undefined : onConfirm}
              disabled={confirmDisabled}
              activeOpacity={0.75}
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 22,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 21,
    marginBottom: 20,
  },

  // Checkbox row (checkConfirm variant)
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    marginBottom: 18,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkText: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },

  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelLabel: {
    color: Colors.textPrimary,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmLabel: {
    color: '#FFFFFF',
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
});
