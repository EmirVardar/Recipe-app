import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

const colors = {
  accent: '#F97316',
  inactive: '#9CA3AF',
  background: '#F8FAFC',
  border: '#FDBA74',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: colors.border,
          height: 76,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarIcon: ({ color, size }) => {
          const iconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: 'home-outline',
            search: 'search-outline',
            'my-recipes': 'heart-outline',
            health: 'fitness-outline',
            profile: 'person-outline',
          };

          const focusedIconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: 'home',
            search: 'search',
            'my-recipes': 'heart',
            health: 'fitness',
            profile: 'person',
          };

          const iconName = route.name in iconByRoute ? iconByRoute[route.name] : 'ellipse-outline';
          const focusedIconName =
            route.name in focusedIconByRoute ? focusedIconByRoute[route.name] : 'ellipse';

          return <Ionicons name={color === colors.accent ? focusedIconName : iconName} size={size} color={color} />;
        },
      })}>
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="search" options={{ title: 'Ara' }} />
      <Tabs.Screen name="my-recipes" options={{ title: 'Tariflerim' }} />
      <Tabs.Screen
        name="health"
        options={{
          title: 'Saglik',
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '500',
          },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
