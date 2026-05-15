import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  title?: string;
  message?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function EmptyState({ title, message, style, children }: Props) {
  return (
    <View style={[styles.container, style]}>
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
    padding: 24,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  message: { color: '#666', textAlign: 'center' },
});
