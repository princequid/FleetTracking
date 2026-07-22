import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { DISPATCH_PHONE, SUPPORT_EMAIL } from '../../constants/config';

const FAQS = [
  {
    q: 'How do I start a trip?',
    a: 'Open the trip from your dashboard, capture the pre-dispatch photo when prompted, then tap "Move to pickup" to begin live navigation.',
  },
  {
    q: 'What if my photo upload fails?',
    a: 'Check that you have a network connection and try again — the app keeps the photo and retries automatically in the background once you\'re back online. If it keeps failing, contact support below.',
  },
  {
    q: 'Why can\'t I start a new trip?',
    a: 'You can only have one trip in progress at a time. Finish or hand off your current active trip before starting another one.',
  },
  {
    q: 'How do I report an incident?',
    a: 'From an active trip, use the "Report issue" quick action on your dashboard to log an incident with a description and severity.',
  },
  {
    q: 'My location isn\'t updating correctly, what do I do?',
    a: 'Make sure location permissions are set to "Always" or "While using the app" in your device settings, and that GPS/location services are turned on.',
  },
  {
    q: 'Who do I contact if I\'m stuck on a delivery?',
    a: 'Call dispatch using the button below — they can see your active trip and can help in real time.',
  },
];

function ContactRow({ icon, title, sub, onPress, C, styles }) {
  return (
    <Pressable
      style={styles.contactRow}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
    >
      <View style={styles.contactIcon}>
        <Feather name={icon} size={18} color={C.navyPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.contactTitle}>{title}</Text>
        <Text style={styles.contactSub}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={C.text3} />
    </Pressable>
  );
}

function FaqItem({ item, open, onToggle, C, styles }) {
  const rotation = useSharedValue(open ? 90 : 0);
  rotation.value = withTiming(open ? 90 : 0, { duration: 180 });
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.faqCard}>
      <Pressable style={styles.faqHeader} onPress={onToggle}>
        <Text style={styles.faqQuestion}>{item.q}</Text>
        <Animated.View style={chevronStyle}>
          <Feather name="chevron-right" size={16} color={C.text3} />
        </Animated.View>
      </Pressable>
      {open && <Text style={styles.faqAnswer}>{item.a}</Text>}
    </View>
  );
}

export default function HelpSupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [openFaq, setOpenFaq] = useState(null);

  const callDispatch = async () => {
    const url = `tel:${DISPATCH_PHONE}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Unable to place call', `Please dial ${DISPATCH_PHONE} manually.`);
      return;
    }
    Linking.openURL(url);
  };

  const emailSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('FleetSync driver app — support request')}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('No email app found', `Please email us at ${SUPPORT_EMAIL}.`);
      return;
    }
    Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: Math.max(16, insets.top + 12) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Feather name="chevron-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Feather name="help-circle" size={20} color={C.navyPrimary} />
          </View>
          <Text style={styles.introTitle}>We're here to help</Text>
          <Text style={styles.introBody}>
            Browse common questions below, or reach your fleet manager directly if you need
            help right now.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>CONTACT</Text>
        <View style={styles.contactGroup}>
          <ContactRow
            icon="phone"
            title="Call dispatch"
            sub={DISPATCH_PHONE}
            onPress={callDispatch}
            C={C}
            styles={styles}
          />
          <View style={styles.contactDivider} />
          <ContactRow
            icon="mail"
            title="Email support"
            sub={SUPPORT_EMAIL}
            onPress={emailSupport}
            C={C}
            styles={styles}
          />
        </View>

        <Text style={styles.sectionLabel}>FREQUENTLY ASKED QUESTIONS</Text>
        <View style={{ gap: 10 }}>
          {FAQS.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              open={openFaq === i}
              onToggle={() => {
                Haptics.selectionAsync();
                setOpenFaq((prev) => (prev === i ? null : i));
              }}
              C={C}
              styles={styles}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: {
    backgroundColor: C.navyDark,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  introCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 4,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  introTitle: { fontFamily: 'Inter-Bold', fontSize: 16, color: C.text1 },
  introBody: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text2, lineHeight: 19 },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: C.text3,
    marginTop: 8,
    marginBottom: -2,
  },
  contactGroup: {
    backgroundColor: C.surface,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  contactDivider: { height: 1, backgroundColor: C.border, marginLeft: 16 + 36 + 12 },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1 },
  contactSub: { fontFamily: 'Inter-Regular', fontSize: 12.5, color: C.text3, marginTop: 1 },
  faqCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  faqQuestion: { flex: 1, fontFamily: 'Inter-SemiBold', fontSize: 13.5, color: C.text1 },
  faqAnswer: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: C.text2,
    lineHeight: 19,
    marginTop: 10,
  },
});
