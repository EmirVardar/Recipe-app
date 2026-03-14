import { StyleSheet, Text, View } from 'react-native';

export default function SearchTabScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Ara</Text>
      <Text style={styles.body}>Tarif arama alanini buraya baglayacagiz.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#EA580C',
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    color: '#6B7280',
  },
});
