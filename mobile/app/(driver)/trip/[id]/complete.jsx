import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../../theme/ThemeContext';

function ConfettiDot({ delay, left, color, styles }) {
  const y       = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate  = y.interpolate({ inputRange: [0, 220], outputRange: ['0deg', '440deg'] });

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(y, { toValue: 220, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(delay + 800),
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.confDot,
        { backgroundColor: color, position: 'absolute', top: 0, left },
        { transform: [{ translateY: y }, { rotate }], opacity },
      ]}
    />
  );
}

const confettiPieces = (C) => [
  { delay: 0,   left: '10%', color: C.teal },
  { delay: 80,  left: '25%', color: C.amber },
  { delay: 30,  left: '40%', color: C.green },
  { delay: 120, left: '55%', color: C.navyMid },
  { delay: 60,  left: '70%', color: C.teal },
  { delay: 150, left: '85%', color: C.red },
  { delay: 20,  left: '50%', color: C.amber },
  { delay: 100, left: '15%', color: C.green },
];

export default function TripCompleteScreen() {
  const router = useRouter();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { id } = useLocalSearchParams();

  const CONFETTI = useMemo(() => confettiPieces(C), [C]);

  const checkScale   = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const cardY        = useRef(new Animated.Value(40)).current;
  const cardOpacity  = useRef(new Animated.Value(0)).current;
  const ringScale    = useRef(new Animated.Value(0.6)).current;
  const ringOpacity  = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, damping: 12, stiffness: 120, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(ringScale,   { toValue: 1.4, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0,   duration: 800, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.spring(cardY, { toValue: 0, damping: 16, stiffness: 140, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.top}>
        <View style={styles.confettiLayer} pointerEvents="none">
          {CONFETTI.map((c, i) => <ConfettiDot key={i} {...c} styles={styles} />)}
        </View>

        <View style={styles.iconWrap}>
          <Animated.View style={[styles.ringBurst, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }], opacity: checkOpacity }]}>
            <Feather name="check" size={44} color="#fff" />
          </Animated.View>
        </View>

        <Text style={styles.congrats}>Trip Delivered!</Text>
        <Text style={styles.subText}>Excellent work. Your delivery has been confirmed.</Text>
      </View>

      <Animated.View style={[styles.card, { transform: [{ translateY: cardY }], opacity: cardOpacity }]}>
        <Text style={styles.cardTitle}>Trip Summary</Text>
        <View style={styles.cardRow}>
          <View style={styles.cardItem}>
            <Feather name="hash" size={14} color={C.text3} />
            <Text style={styles.cardKey}>Trip ID</Text>
            <Text style={styles.cardVal}>#{String(id)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardItem}>
            <Feather name="clock" size={14} color={C.text3} />
            <Text style={styles.cardKey}>Status</Text>
            <Text style={[styles.cardVal, { color: C.green }]}>DELIVERED</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardItem}>
            <Feather name="check-circle" size={14} color={C.text3} />
            <Text style={styles.cardKey}>POD</Text>
            <Text style={[styles.cardVal, { color: C.green }]}>Captured</Text>
          </View>
        </View>
      </Animated.View>

      <View style={styles.btns}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(driver)/dashboard_2')}>
          <Text style={styles.primaryBtnText}>Back to home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push('/(driver)/trip/history_2')}>
          <Text style={styles.ghostBtnText}>View trip history</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  top: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 12, overflow: 'hidden', position: 'relative',
  },
  confettiLayer: { position: 'absolute', top: 30, left: 0, right: 0, height: 230 },
  confDot: { width: 10, height: 10, borderRadius: 2 },
  iconWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ringBurst: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: C.green,
  },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  congrats: { fontFamily: 'Inter-ExtraBold', fontSize: 28, color: C.text1, letterSpacing: -0.5 },
  subText: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.text3, textAlign: 'center', lineHeight: 22 },
  card: {
    marginHorizontal: 20, backgroundColor: C.surface, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  cardTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text2, marginBottom: 14 },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardItem: { flex: 1, alignItems: 'center', gap: 4 },
  cardKey: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3 },
  cardVal: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.text1 },
  divider: { width: 1, backgroundColor: C.border },
  btns: { padding: 20, gap: 10 },
  primaryBtn: {
    height: 54, backgroundColor: C.navyPrimary, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.navyPrimary, shadowOpacity: 0.2, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  primaryBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
  ghostBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  ghostBtnText: { fontFamily: 'Inter-Medium', fontSize: 14, color: C.text2 },
});
