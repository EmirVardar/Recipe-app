import { Pressable, StyleSheet, Text, View } from 'react-native';

type RecipeAccessBannerProps = {
  onOpenProfile?: () => void;
};

export function RecipeAccessBanner({ onOpenProfile }: RecipeAccessBannerProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tarifleri görmek için giriş yap</Text>
      <Text style={styles.body}>
        Profil sekmesinden giriş yaptığında tarifler burada otomatik olarak görünecek.
      </Text>
      {onOpenProfile ? (
        <Pressable style={styles.button} onPress={onOpenProfile}>
          <Text style={styles.buttonText}>Profile git</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E8ED',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 10,
  },
  title: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: '#6E6E73',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#1C1C1E',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
