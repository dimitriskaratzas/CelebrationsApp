import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from './theme';

// Deterministic two-tone gradient palette seeded from the name hash.
// Same name → same colors → stable identity across sessions.
const AVATAR_COLORS: [string, string][] = [
  ['#C9A961', '#8E6E2A'], // gold
  ['#3F6BAA', '#1F3D6E'], // aegean
  ['#C26A4A', '#7E3E25'], // terracotta
  ['#6F8E5F', '#3F5836'], // olive
  ['#B6588E', '#7A2F5A'], // hibiscus
  ['#5C8FA3', '#34616F'], // sea
  ['#A87049', '#6C4226'], // cinnamon
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarColorsFor(name: string): [string, string] {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length]!;
}

function monogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

interface Props {
  name: string;
  /** Gold ring indicates a nameday-type favorite. */
  ringed?: boolean;
  size?: number;
}

export function Avatar({ name, ringed = false, size = 44 }: Props) {
  const colors = avatarColorsFor(name);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
        },
        ringed && [styles.ring, { borderRadius: size / 2 }],
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={[styles.label, { fontSize: size * 0.4 }]}>{monogram(name)}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    borderColor: theme.gold,
  },
  gradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#fff',
  },
});
