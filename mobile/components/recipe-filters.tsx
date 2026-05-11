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
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Filtreler</Text>

      <View style={styles.row}>
        <TextInput
          value={value.minCalories}
          onChangeText={(text) => onChange({ ...value, minCalories: text })}
          style={styles.input}
          keyboardType="number-pad"
          placeholder="Min kalori"
          placeholderTextColor="#9CA3AF"
        />
        <TextInput
          value={value.maxCalories}
          onChangeText={(text) => onChange({ ...value, maxCalories: text })}
          style={styles.input}
          keyboardType="number-pad"
          placeholder="Max kalori"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.chipsWrap}>
        <FilterChip
          label="Protein yuksek"
          active={value.highProtein}
          onPress={() => onChange({ ...value, highProtein: !value.highProtein })}
        />
        <FilterChip
          label="30 dk ve alti"
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
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#FFF7ED',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  chipText: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#EA580C',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
