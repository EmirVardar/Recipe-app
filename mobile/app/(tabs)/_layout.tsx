import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

const colors = {
  accent: '#1C1C1E',
  inactive: '#8E8E93',
  background: '#F5F5F7',
  border: '#E5E5EA',
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
          height: 72,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarIcon: ({ color, size }) => {
          const iconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: 'home-outline',
            search: 'sparkles-outline',
            fridge: 'cube-outline',
            'my-recipes': 'heart-outline',
            health: 'fitness-outline',
            profile: 'person-outline',
          };

          const focusedIconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
            index: 'home',
            search: 'sparkles',
            fridge: 'cube',
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
      <Tabs.Screen name="search" options={{ title: 'Assistant' }} />
      <Tabs.Screen name="fridge" options={{ title: 'Buzdolabı' }} />
      <Tabs.Screen name="my-recipes" options={{ title: 'Tariflerim' }} />
      <Tabs.Screen
        name="health"
        options={{
          title: 'Sağlık',
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '600',
          },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
