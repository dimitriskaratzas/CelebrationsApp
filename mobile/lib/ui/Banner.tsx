import { StyleSheet, Text, View } from 'react-native';

interface Props {
  tone?: 'warning' | 'error' | 'info';
  message: string;
}

export function Banner({ tone = 'warning', message }: Props) {
  const bg = tone === 'error' ? '#fdecea' : tone === 'info' ? '#e3f2fd' : '#fff8e1';
  const fg = tone === 'error' ? '#b71c1c' : tone === 'info' ? '#0d47a1' : '#8d6e00';
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 10 },
  text: { fontSize: 13, fontWeight: '500' },
});
