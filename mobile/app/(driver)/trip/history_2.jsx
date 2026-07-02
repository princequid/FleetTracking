import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { C } from '../../../constants/colors';

export default function TripHistoryScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Trip History</Text>
      </View>
      <View style={styles.empty}>
        <Feather name="clock" size={44} color={C.border} />
        <Text style={styles.emptyTitle}>No history yet</Text>
        <Text style={styles.emptySub}>Completed trips will appear here</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.navyDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: C.text1 },
  emptySub: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.text3 },
});
