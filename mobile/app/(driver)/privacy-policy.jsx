import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

const LAST_UPDATED = 'July 2026';

const SECTIONS = [
  {
    icon: 'map-pin',
    title: 'Location data',
    body:
      'While you are on shift or an active trip, FleetSync records your device’s GPS ' +
      'location (latitude, longitude, speed and heading) so your fleet manager can track ' +
      'the vehicle, calculate ETAs, and detect route deviations. Location tracking pauses ' +
      'once a trip is completed or you sign out — we do not track your location outside ' +
      'of active work sessions.',
  },
  {
    icon: 'camera',
    title: 'Photos & proof of delivery',
    body:
      'Pre-dispatch and proof-of-delivery photos you capture in the app are uploaded and ' +
      'attached to the relevant trip record. They are used only to confirm vehicle condition ' +
      'and delivery completion, and are visible to dispatch and your fleet manager.',
  },
  {
    icon: 'truck',
    title: 'Trip & delivery data',
    body:
      'We store trip assignments, routes, stops, timestamps, and delivery status so your ' +
      'trip history, performance stats (on-time rate, completed trips) and earnings can be ' +
      'calculated accurately.',
  },
  {
    icon: 'user',
    title: 'Account information',
    body:
      'Your name, email, phone number and licence number are used to identify you within ' +
      'the fleet, assign trips, and contact you about deliveries. This information is only ' +
      'visible to your fleet’s dispatch and administration staff.',
  },
  {
    icon: 'bell',
    title: 'Push notifications',
    body:
      'With your permission, we send push notifications for new trip assignments, dispatch ' +
      'messages, and delivery updates. You can manage these anytime from Notifications in ' +
      'this app or your device settings.',
  },
  {
    icon: 'share-2',
    title: 'Data sharing',
    body:
      'Your trip and location data is shared only with your fleet’s dispatch and ' +
      'management team through the FleetSync admin portal. We do not sell your personal ' +
      'data to third parties or use it for advertising.',
  },
  {
    icon: 'clock',
    title: 'Data retention',
    body:
      'Trip records, GPS logs and delivery photos are retained for as long as your account ' +
      'is active and for a limited period afterward to meet operational and compliance ' +
      'needs, after which they are deleted.',
  },
  {
    icon: 'shield',
    title: 'Security',
    body:
      'Data is transmitted over encrypted connections and stored on access-controlled ' +
      'servers. Authentication tokens on this device are kept in the OS secure store, never ' +
      'in plain text.',
  },
  {
    icon: 'check-square',
    title: 'Your choices',
    body:
      'You can review the personal details on your Profile screen, control notification ' +
      'permissions from your device settings, and contact your fleet administrator to ' +
      'request a copy or deletion of your data.',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: Math.max(16, insets.top + 12) }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Feather name="shield" size={20} color={C.navyPrimary} />
          </View>
          <Text style={styles.introTitle}>Your data, and how we use it</Text>
          <Text style={styles.introBody}>
            This explains what FleetSync collects while you use the driver app, why we
            collect it, and who can see it.
          </Text>
          <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>
        </View>

        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Feather name={s.icon} size={16} color={C.navyPrimary} />
              </View>
              <Text style={styles.sectionTitle}>{s.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.contactCard}>
          <Feather name="mail" size={16} color={C.teal} />
          <Text style={styles.contactText}>
            Questions about your data? Reach out to your fleet administrator through
            Help & Support.
          </Text>
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
  updated: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3, marginTop: 4 },
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1 },
  sectionBody: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text2, lineHeight: 19 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.tealPale,
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  contactText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 12.5, color: C.text1, lineHeight: 18 },
});
