import { SafeAreaView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from './theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenContainer({ children, style }: Props) {
  return <SafeAreaView style={[styles.container, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
});
