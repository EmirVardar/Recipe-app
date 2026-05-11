import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export type RecipeFilters = {
  category: string;
  minCalories: string;
  maxCalories: string;
  highProtein: boolean;
  shortTime: boolean;
  vegetarian: boolean;
  vegan: boolean;
};

type RecipeFiltersProps = {
  value: RecipeFilters;
  onChange: (next: RecipeFilters) => void;
  onApply: () => void;
  onReset: () => void;
};

export const defaultRecipeFilters: RecipeFilters = {
  category: '',
  minCalories: '',
  maxCalories: '',
  highProtein: false,
  shortTime: false,
  vegetarian: false,
  vegan: false,
};

const CATEGORY_OPTIONS = [
  { label: 'Tümü', value: '' },
  { label: 'Kahvaltı', value: 'breakfast' },
  { label: 'Salata', value: 'salad' },
  { label: 'Çorba', value: 'soup' },
  { label: 'Tatlı', value: 'dessert' },
  { label: 'Ana Yemek', value: 'main' },
];

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active ? styles.chipActive : null]} onPress={onPress}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function RecipeFiltersCard({ value, onChange, onApply, onReset }: RecipeFiltersProps) {
  const activeCount = [
    value.category.length > 0,
    value.minCalories.trim().length > 0,
    value.maxCalories.trim().length > 0,
    value.highProtein,
    value.shortTime,
    value.vegetarian,
    value.vegan,
  ].filter(Boolean).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Tarif Seçimi</Text>
          <Text style={styles.title}>Sonuçları daralt</Text>
        </View>
        {activeCount > 0 ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{activeCount} aktif</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Kategori</Text>
        <View style={styles.categoryWrap}>
          {CATEGORY_OPTIONS.map((option) => {
            const active = value.category === option.value;

            return (
              <Pressable
                key={option.value || 'all'}
                style={[styles.categoryChip, active ? styles.categoryChipActive : null]}
                onPress={() => onChange({ ...value, category: option.value })}>
                <Text style={[styles.categoryChipText, active ? styles.categoryChipTextActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Kalori aralığı</Text>
        <View style={styles.row}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputHint}>Minimum</Text>
            <TextInput
              value={value.minCalories}
              onChangeText={(text) => onChange({ ...value, minCalories: text })}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Orn. 250"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputHint}>Maksimum</Text>
            <TextInput
              value={value.maxCalories}
              onChangeText={(text) => onChange({ ...value, maxCalories: text })}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Orn. 650"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Hızlı tercihler</Text>
        <View style={styles.chipsWrap}>
          <FilterChip
            label="Protein yüksek"
            active={value.highProtein}
            onPress={() => onChange({ ...value, highProtein: !value.highProtein })}
          />
          <FilterChip
            label="30 dk ve altı"
            active={value.shortTime}
            onPress={() => onChange({ ...value, shortTime: !value.shortTime })}
          />
          <FilterChip
            label="Vejetaryen"
            active={value.vegetarian}
            onPress={() => onChange({ ...value, vegetarian: !value.vegetarian })}
          />
          <FilterChip
            label="Vegan"
            active={value.vegan}
            onPress={() => onChange({ ...value, vegan: !value.vegan })}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onReset}>
          <Text style={styles.secondaryButtonText}>Temizle</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onApply}>
          <Text style={styles.primaryButtonText}>Uygula</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: '#F5F5F7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeBadgeText: {
    color: '#6E6E73',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#F8F8FA',
    borderRadius: 22,
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    color: '#3A3A3C',
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categoryChipActive: {
    backgroundColor: '#1C1C1E',
    borderColor: '#1C1C1E',
  },
  categoryChipText: {
    color: '#3A3A3C',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  inputWrap: {
    flex: 1,
    gap: 8,
  },
  inputHint: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111111',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: '#EFEFF4',
    borderColor: '#D1D1D6',
  },
  chipText: {
    color: '#3A3A3C',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#111111',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  secondaryButtonText: {
    color: '#3A3A3C',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
