import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from './theme';

type Tone = 'warning' | 'error' | 'info' | 'success';

interface Props {
  tone?: Tone;
  message: string;
  title?: string;
}

interface ToneStyle {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  title: string;
  text: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const TONES: Record<Tone, ToneStyle> = {
  warning: {
    bg: 'rgba(255, 201, 60, 0.10)',
    border: 'rgba(255, 201, 60, 0.45)',
    iconBg: 'rgba(255, 201, 60, 0.20)',
    iconColor: '#8E6E2A',
    title: '#5A4200',
    text: theme.ink,
    icon: 'warning-outline',
  },
  error: {
    bg: 'rgba(224, 79, 106, 0.08)',
    border: 'rgba(224, 79, 106, 0.35)',
    iconBg: 'rgba(224, 79, 106, 0.18)',
    iconColor: theme.destructive,
    title: '#8E2433',
    text: theme.ink,
    icon: 'alert-circle-outline',
  },
  info: {
    bg: theme.accentSoft,
    border: 'rgba(15, 76, 129, 0.20)',
    iconBg: 'rgba(15, 76, 129, 0.14)',
    iconColor: theme.accent,
    title: theme.accent,
    text: theme.ink,
    icon: 'information-circle-outline',
  },
  success: {
    bg: 'rgba(60, 143, 94, 0.08)',
    border: 'rgba(60, 143, 94, 0.30)',
    iconBg: 'rgba(60, 143, 94, 0.16)',
    iconColor: theme.success,
    title: '#1F5E37',
    text: theme.ink,
    icon: 'checkmark-circle-outline',
  },
};

export function Banner({ tone = 'warning', message, title }: Props) {
  const t = TONES[tone];
  return (
    <View style={[styles.container, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: t.iconBg }]}>
        <Ionicons name={t.icon} size={18} color={t.iconColor} />
      </View>
      <View style={styles.textWrap}>
        {title ? <Text style={[styles.title, { color: t.title }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: t.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 2 },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  message: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 19,
  },
});
