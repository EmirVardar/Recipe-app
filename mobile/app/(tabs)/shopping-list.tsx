import { StyleSheet, Text, View } from 'react-native';

export default function ShoppingListTabScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Alisveris Listesi</Text>
      <Text style={styles.body}>Tarif malzeme listelerini burada yonetecegiz.</Text>
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
