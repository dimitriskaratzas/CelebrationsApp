import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { shadow, spacing, theme } from '@/lib/ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IoniconName;
  eyebrow: string;
  title: string;
  lede: string;
  bullets?: string[];
}

export function ComingSoonScreen({ icon, eyebrow, title, lede, bullets = [] }: Props) {
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[theme.bgTop, theme.bgBottom]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero illustration: layered halo around the icon */}
        <View style={styles.hero}>
          <View style={styles.haloOuter} />
          <View style={styles.haloMid} />
          <LinearGradient
            colors={[theme.accent, theme.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.haloInner, shadow.card]}
          >
            <Ionicons name={icon} size={32} color={theme.gold} />
          </LinearGradient>
          {/* Decorative scattered dots */}
          <View style={[styles.dot, styles.dotA]} />
          <View style={[styles.dot, styles.dotB]} />
          <View style={[styles.dot, styles.dotC]} />
        </View>

        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowText}>{eyebrow}</Text>
          <View style={styles.eyebrowDot} />
          <Text style={styles.phasePill}>Φάση 4</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.lede}>{lede}</Text>

        {bullets.length > 0 ? (
          <View style={styles.bulletList}>
            {bullets.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.checkDot}>
                  <Ionicons name="checkmark" size={12} color={theme.accent} />
                </View>
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgTop },
  scroll: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },

  // Hero
  hero: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  haloOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(15, 76, 129, 0.04)',
  },
  haloMid: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(15, 76, 129, 0.08)',
  },
  haloInner: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  dot: {
    position: 'absolute',
    borderRadius: 99,
  },
  dotA: {
    width: 10,
    height: 10,
    backgroundColor: theme.gold,
    top: 28,
    right: 38,
  },
  dotB: {
    width: 6,
    height: 6,
    backgroundColor: theme.accent,
    bottom: 36,
    left: 30,
  },
  dotC: {
    width: 8,
    height: 8,
    backgroundColor: 'rgba(15, 76, 129, 0.40)',
    bottom: 22,
    right: 52,
  },

  // Eyebrow + phase pill row
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  eyebrowText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    color: theme.accent,
  },
  eyebrowDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.muted,
  },
  phasePill: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.goldDark,
  },

  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.4,
    color: theme.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
    maxWidth: 320,
  },
  lede: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    lineHeight: 23,
    color: theme.muted,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.xl,
  },

  bulletList: {
    width: '100%',
    maxWidth: 340,
    gap: 10,
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: theme.radius.card,
    padding: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: theme.ink,
  },
});
