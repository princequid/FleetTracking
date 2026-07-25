import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, SafeAreaView, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import api from '../../../../services/api_1';
import { useTheme } from '../../../../theme/ThemeContext';

// `value` is the backend IncidentType enum this option maps to (the UI `key` stays
// unique so tile selection works; several UI options can share an enum value).
const incidentTypes = (C) => [
  { key: 'ACCIDENT',  label: 'Accident',  value: 'ACCIDENT',          icon: 'alert-triangle',  color: C.red,     bg: C.redLight },
  { key: 'BREAKDOWN', label: 'Breakdown', value: 'VEHICLE_BREAKDOWN', icon: 'tool',            color: C.amber,   bg: C.amberLight },
  { key: 'DELAY',     label: 'Delay',     value: 'OTHER',             icon: 'clock',           color: C.navyMid, bg: C.accentSoft },
  { key: 'OTHER',     label: 'Other',     value: 'OTHER',             icon: 'more-horizontal', color: C.text3,   bg: C.bg },
];

const urgencyLevels = (C) => [
  { key: 'LOW',    label: 'Low',    color: C.green },
  { key: 'MEDIUM', label: 'Medium', color: C.amber },
  { key: 'HIGH',   label: 'High',   color: C.red },
];

export default function IncidentReportScreen() {
  const router   = useRouter();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const TYPES = useMemo(() => incidentTypes(C), [C]);
  const URGENCIES = useMemo(() => urgencyLevels(C), [C]);
  const { tripId } = useLocalSearchParams();
  const actualTripId = String(tripId).replace('_3', '');

  const [type, setType]       = useState('');
  const [urgency, setUrgency] = useState('');
  const [description, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError]     = useState('');

  const successScale   = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const errorOpacity   = useRef(new Animated.Value(0)).current;
  const errorHeight    = useRef(new Animated.Value(0)).current;

  const showError = (msg) => {
    setError(msg);
    Animated.parallel([
      Animated.timing(errorOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(errorHeight,  { toValue: 44, duration: 200, useNativeDriver: false }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(errorOpacity, { toValue: 0, duration: 300, useNativeDriver: false }),
        Animated.timing(errorHeight,  { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start(() => setError(''));
    }, 3000);
  };

  const submit = async () => {
    if (!type) { showError('Please select an incident type.'); return; }
    if (!urgency) { showError('Please select urgency level.'); return; }
    if (description.trim().length < 10) { showError('Please add a description (min 10 chars).'); return; }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // incident-service exposes POST /incidents and expects the enum-shaped body.
      const incidentType = TYPES.find((t) => t.key === type)?.value || 'OTHER';
      await api.post('/incidents', {
        tripId: Number(actualTripId),
        incidentType,
        severity: urgency,
        description: description.trim(),
      });
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, damping: 12, stiffness: 120, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } catch (_) {
      showError('Failed to submit. Check connection.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.successWrap}>
        <Animated.View style={[styles.successIcon, { transform: [{ scale: successScale }], opacity: successOpacity }]}>
          <Feather name="check" size={40} color="#fff" />
        </Animated.View>
        <Text style={styles.successTitle}>Report Submitted</Text>
        <Text style={styles.successSub}>Fleet management has been notified and will respond shortly.</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={20} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Incident</Text>
          <Text style={styles.headerSub}>Trip #{actualTripId}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.errorBanner, { opacity: errorOpacity, height: errorHeight, overflow: 'hidden' }]}>
            <Feather name="alert-circle" size={14} color={C.red} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>

          <Text style={styles.sectionLabel}>INCIDENT TYPE</Text>
          <View style={styles.typeGrid}>
            {TYPES.map((t) => {
              const selected = type === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeCard, selected && { borderColor: t.color, backgroundColor: t.bg }]}
                  onPress={() => { setType(t.key); Haptics.selectionAsync(); }}
                >
                  <View style={[styles.typeIcon, { backgroundColor: t.bg }]}>
                    <Feather name={t.icon} size={18} color={t.color} />
                  </View>
                  <Text style={[styles.typeLabel, selected && { color: t.color }]}>{t.label}</Text>
                  {selected && (
                    <View style={[styles.typeCheck, { backgroundColor: t.color }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>URGENCY LEVEL</Text>
          <View style={styles.urgencyRow}>
            {URGENCIES.map((u) => {
              const selected = urgency === u.key;
              return (
                <TouchableOpacity
                  key={u.key}
                  style={[styles.urgencyBtn, selected && { backgroundColor: u.color, borderColor: u.color }]}
                  onPress={() => { setUrgency(u.key); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.urgencyText, selected ? { color: '#fff' } : { color: C.text2 }]}>
                    {u.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DESCRIPTION</Text>
          <View style={[styles.textareaWrap, focused && styles.textareaFocused]}>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDesc}
              placeholder="Describe what happened in detail…"
              placeholderTextColor={C.text3}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>
          <Text style={styles.charCount}>{description.length} / 500</Text>

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={submit}
            disabled={loading}
          >
            <Feather name="send" size={16} color="#fff" />
            <Text style={styles.submitText}>{loading ? 'Submitting…' : 'Submit report'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: { backgroundColor: C.navyDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText: { fontFamily: 'Inter-Medium', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  headerSub:   { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  form: { padding: 20, gap: 4 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.redLight, borderRadius: 10,
    paddingHorizontal: 14, marginBottom: 8,
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.red, flex: 1 },
  sectionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text3, letterSpacing: 0.8, marginBottom: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: C.border, position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  typeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.text1 },
  typeCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  urgencyRow: { flexDirection: 'row', gap: 10 },
  urgencyBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  urgencyText: { fontFamily: 'Inter-SemiBold', fontSize: 13 },
  textareaWrap: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  textareaFocused: { borderColor: C.navyPrimary },
  textarea: { fontFamily: 'Inter-Regular', fontSize: 15, color: C.text1, minHeight: 120, lineHeight: 22 },
  charCount: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3, textAlign: 'right', marginTop: 4 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, backgroundColor: C.navyPrimary, borderRadius: 14, marginTop: 16,
    shadowColor: C.navyPrimary, shadowOpacity: 0.2, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  submitText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
  successWrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  successIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8, marginBottom: 8,
  },
  successTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 24, color: C.text1, letterSpacing: -0.3 },
  successSub:   { fontFamily: 'Inter-Regular', fontSize: 14, color: C.text3, textAlign: 'center', lineHeight: 22 },
  doneBtn: { marginTop: 8, height: 54, width: '100%', backgroundColor: C.navyPrimary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
});
