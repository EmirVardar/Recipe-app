import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type HomeFeedKey = 'editorsChoice' | 'forYou';
const FEED_ORDER: HomeFeedKey[] = ['editorsChoice', 'forYou'];

const feedContent: Record<
  HomeFeedKey,
  {
    heroImage: string;
    kicker: string;
    title: string;
    author: string;
    metric: string;
  }
> = {
  editorsChoice: {
    heroImage:
      'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80',
    kicker: 'Bugunun Tarifi',
    title: 'Pasta al limone',
    author: 'ReciPulse Studio',
    metric: '34.7K',
  },
  forYou: {
    heroImage:
      'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80',
    kicker: 'Senin Icin',
    title: 'Lezzetli Kase',
    author: 'ReciPulse Match',
    metric: '21.4K',
  },
};

export default function HomeTabScreen() {
  const { width: pageWidth } = useWindowDimensions();
  const [activeFeed, setActiveFeed] = useState<HomeFeedKey>('editorsChoice');
  const activeFeedRef = useRef<HomeFeedKey>('editorsChoice');
  const slideX = useRef(new Animated.Value(0)).current;
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Object.values(feedContent).forEach((content) => {
      Image.prefetch(content.heroImage);
    });
  }, []);

  useEffect(() => {
    const activeIndex = FEED_ORDER.indexOf(activeFeedRef.current);
    slideX.setValue(-activeIndex * pageWidth);
    indicatorX.setValue(activeIndex * (pageWidth / FEED_ORDER.length));
  }, [pageWidth, slideX, indicatorX]);

  const handleFeedChange = (nextFeed: HomeFeedKey) => {
    if (nextFeed === activeFeed) {
      return;
    }

    const nextIndex = FEED_ORDER.indexOf(nextFeed);
    activeFeedRef.current = nextFeed;
    setActiveFeed(nextFeed);
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: -nextIndex * pageWidth,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(indicatorX, {
        toValue: nextIndex * (pageWidth / FEED_ORDER.length),
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderFeedPage = (feedKey: HomeFeedKey) => {
    const content = feedContent[feedKey];
    return (
      <View key={feedKey} style={[styles.feedPage, { width: pageWidth }]}>
        <Image source={{ uri: content.heroImage }} style={styles.hero} resizeMode="cover" />

        <View style={styles.card}>
          <Text style={styles.kicker}>{content.kicker}</Text>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.author}>{content.author}</Text>

          <View style={styles.metricsPill}>
            <Text style={styles.metricsText}>{content.metric}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tabsHeader}>
          <View style={styles.topRow}>
            <Pressable onPress={() => handleFeedChange('editorsChoice')} style={styles.topTabButton}>
              <Text style={[styles.tabText, activeFeed === 'editorsChoice' ? styles.tabActive : styles.tabInactive]}>
                Editor Secimi
              </Text>
            </Pressable>
            <Pressable onPress={() => handleFeedChange('forYou')} style={styles.topTabButton}>
              <Text style={[styles.tabText, activeFeed === 'forYou' ? styles.tabActive : styles.tabInactive]}>
                Senin Icin
              </Text>
            </Pressable>
          </View>
          <View style={styles.indicatorTrack}>
            <Animated.View
              style={[
                styles.indicatorActive,
                {
                  width: pageWidth / FEED_ORDER.length,
                  transform: [{ translateX: indicatorX }],
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.carouselViewport}>
          <Animated.View
            style={[
              styles.carouselTrack,
              {
                width: pageWidth * FEED_ORDER.length,
                transform: [{ translateX: slideX }],
              },
            ]}>
            {FEED_ORDER.map((feedKey) => renderFeedPage(feedKey))}
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingBottom: 20,
  },
  tabsHeader: {
    marginBottom: 0,
  },
  topRow: {
    paddingTop: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  topTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
    letterSpacing: 0.25,
  },
  tabActive: {
    color: '#EA580C',
  },
  tabInactive: {
    color: '#6B7280',
  },
  indicatorTrack: {
    height: 2,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  indicatorActive: {
    height: 2,
    backgroundColor: '#EA580C',
  },
  carouselViewport: {
    overflow: 'hidden',
  },
  carouselTrack: {
    flexDirection: 'row',
  },
  feedPage: {
    flexShrink: 0,
  },
  hero: {
    width: '100%',
    height: 360,
  },
  card: {
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#FFF1E6',
    padding: 22,
    minHeight: 180,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  kicker: {
    color: '#9A3412',
    fontSize: 16,
    marginBottom: 8,
  },
  title: {
    color: '#111827',
    fontSize: 42,
    fontWeight: '600',
    marginBottom: 12,
  },
  author: {
    color: '#EA580C',
    fontSize: 18,
    fontWeight: '600',
  },
  metricsPill: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  metricsText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});
