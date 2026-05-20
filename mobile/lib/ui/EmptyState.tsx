import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from './theme';

interface Props {
  /** Ionicon name for the decorative glyph above the title. Default: leaf-outline. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title?: string;
  message?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function EmptyState({ icon = 'leaf-outline', title, message, style, children }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.glyphWrap}>
        <View style={styles.glyphHalo} />
        <Ionicons name={icon} size={32} color={theme.accent} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
    gap: 10,
  },
  glyphWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  glyphHalo: {
    position: 'absolute',
    inset: 0,
    backgroundColor: theme.accentSoft,
    borderRadius: 36,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: theme.ink,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: theme.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
