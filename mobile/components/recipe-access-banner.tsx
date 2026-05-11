import { Pressable, StyleSheet, Text, View } from 'react-native';

type RecipeAccessBannerProps = {
  onOpenProfile?: () => void;
};

export function RecipeAccessBanner({ onOpenProfile }: RecipeAccessBannerProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tarifleri gormek icin giris yap</Text>
      <Text style={styles.body}>
        Profil sekmesinden login oldugunda tarifler burada otomatik olarak gorunecek.
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
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  title: {
    color: '#9A3412',
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    color: '#7C2D12',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#EA580C',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
