import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeContext';

export default function IncidentDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: Math.max(16, insets.top + 12) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Incident Detail</Text>
      </View>
      <View style={styles.empty}>
        <Feather name="alert-triangle" size={44} color={C.border} />
        <Text style={styles.emptyTitle}>Coming soon</Text>
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: { backgroundColor: C.navyDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: C.text1 },
});
