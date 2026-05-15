import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from './theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, disabled, variant = 'primary', style }: Props) {
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.danger
        : 'transparent';
  const fg = variant === 'secondary' ? theme.colors.primary : '#fff';
  const border = variant === 'secondary' ? theme.colors.primary : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
