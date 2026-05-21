import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from './theme';

interface Props {
  message?: string;
  error?: string | null;
  onRetry?: () => void;
}

// Animated cobalt "orbit": two concentric arcs rotating at different speeds around a
// stylized "C" glyph. Replaces a generic ActivityIndicator with something that feels
// branded — calm, slow, Mediterranean rather than a hospital waiting room.
function Orbit() {
  const inner = useRef(new Animated.Value(0)).current;
  const outer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (val: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.timing(val, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
    const animInner = loop(inner, 1800);
    const animOuter = loop(outer, 3200);
    animInner.start();
    animOuter.start();
    return () => {
      animInner.stop();
      animOuter.stop();
    };
  }, [inner, outer]);

  const innerRotate = inner.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const outerRotate = outer.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  return (
    <View style={styles.orbit}>
      <Animated.View
        style={[
          styles.orbitRingOuter,
          { transform: [{ rotate: outerRotate }] },
        ]}
      />
      <Animated.View
        style={[
          styles.orbitRingInner,
          { transform: [{ rotate: innerRotate }] },
        ]}
      />
      <View style={styles.orbitCore}>
        <Text style={styles.orbitGlyph}>C</Text>
      </View>
    </View>
  );
}

export function BootingScreen({ message = 'Συνδεόμαστε…', error, onRetry }: Props) {
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[theme.bgTop, theme.bgBottom]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {error ? (
          <>
            <View style={styles.errIcon}>
              <Ionicons name="cloud-offline-outline" size={32} color={theme.accent} />
            </View>
            <Text style={styles.title}>Δεν ήταν δυνατή η σύνδεση</Text>
            <Text style={styles.message}>{error}</Text>
            {onRetry ? (
              <Pressable
                onPress={onRetry}
                style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.retryText}>Δοκίμασε ξανά</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Orbit />
            <Text style={styles.wordmark}>Celebrations</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgTop },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },

  // Orbit
  orbit: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  orbitRingOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderTopColor: theme.accent,
    borderRightColor: 'rgba(15, 76, 129, 0.20)',
  },
  orbitRingInner: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderBottomColor: theme.gold,
    borderLeftColor: 'rgba(255, 201, 60, 0.25)',
  },
  orbitCore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  orbitGlyph: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    color: theme.accent,
  },

  // Error icon
  errIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  wordmark: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
    color: theme.ink,
    marginTop: 6,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: theme.ink,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: theme.muted,
    textAlign: 'center',
    maxWidth: 320,
  },

  retryBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.accent,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: theme.radius.chip,
  },
  retryText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 14,
    color: '#fff',
  },
  pressed: { opacity: 0.85 },
});
