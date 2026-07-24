import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Dimensions, KeyboardAvoidingView, Platform, ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api_1';
import { useTheme } from '../../theme/ThemeContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { height } = Dimensions.get('window');

// Reached only via the forgot-password flow: tapping "Reset your password" in the
// emailed reset link (fleettrack://reset-password?token=...), sent when a driver taps
// "Forgot password?" on the login screen. Account creation no longer uses this screen
// or wording — a newly-created driver already has a working password and instead sets
// their own via the in-app first-login prompt.
export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets  = useSafeAreaInsets();
  const { token } = useLocalSearchParams();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword]  = useState('');
  const [showPw,          setShowPw]           = useState(false);
  const [loading,         setLoading]          = useState(false);
  const [error,           setError]            = useState('');
  const [done,            setDone]             = useState(false);

  const formShake    = useRef(new Animated.Value(0)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;

  const showError = (msg) => {
    setError(msg);
    Animated.timing(errorOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(formShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue:  8, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue:  0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    if (!token) { showError('This link is missing its token — please use the link from your email.'); return; }
    if (password.length < 8) { showError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { showError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
      setTimeout(() => router.replace('/(auth)/login_1'), 1800);
    } catch (err) {
      showError(err.response?.data?.error || 'This link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.doneWrap, { paddingTop: insets.top + 40 }]}>
        <View style={styles.doneIcon}>
          <Feather name="check" size={28} color="#fff" />
        </View>
        <Text style={styles.doneTitle}>Password updated</Text>
        <Text style={styles.doneSub}>Taking you to sign in…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.surface }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={[styles.topSection, { paddingTop: Math.max(60, insets.top + 20) }]}>
          <Text style={styles.brandName}>FleetSync</Text>
          <Text style={styles.heroLine}>Set your{'\n'}<Text style={styles.heroAccent}>password.</Text></Text>
          <Text style={styles.heroSub}>Choose a password you'll use to sign in from now on.</Text>
        </View>

        <View style={[styles.bottomSection, { paddingBottom: Math.max(40, insets.bottom + 16) }]}>
          <Animated.View style={{ transform: [{ translateX: formShake }] }}>
            {!!error && (
              <Animated.View style={[styles.errorBanner, { opacity: errorOpacity }]}>
                <Feather name="alert-circle" size={14} color={C.red} style={{ marginRight: 6 }} />
                <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
              </Animated.View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New password</Text>
              <View style={[styles.inputWrap, { borderColor: C.border, backgroundColor: C.bg }]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  placeholder="At least 8 characters"
                  placeholderTextColor={C.text3}
                />
                <TouchableOpacity onPress={() => setShowPw((s) => !s)} style={styles.eyeBtn}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={C.text3} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={[styles.inputWrap, { borderColor: C.border, backgroundColor: C.bg }]}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPw}
                  placeholder="Re-enter your password"
                  placeholderTextColor={C.text3}
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.8 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? <LoadingSpinner color="#fff" /> : <Text style={styles.submitText}>Set password</Text>}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  topSection: {
    backgroundColor: C.navyDark,
    paddingTop: 60, paddingBottom: 40, paddingHorizontal: 28,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    gap: 12, minHeight: height * 0.36, justifyContent: 'flex-end',
  },
  brandName:  { fontFamily: 'Inter-ExtraBold', fontSize: 18, color: 'rgba(255,255,255,0.7)', letterSpacing: -0.3 },
  heroLine:   { fontFamily: 'Inter-Bold', fontSize: 26, color: '#fff', lineHeight: 34 },
  heroAccent: { color: C.tealLight },
  heroSub:    { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },
  bottomSection: { flex: 1, backgroundColor: C.surface, paddingHorizontal: 24, paddingTop: 32 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.redLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.red, flex: 1 },
  fieldGroup: { marginBottom: 18, gap: 6 },
  label: { fontFamily: 'Inter-Medium', fontSize: 12, color: C.text2, letterSpacing: 0.1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14,
    shadowColor: C.navyPrimary, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6, elevation: 2,
  },
  input: { height: 48, fontFamily: 'Inter-Regular', fontSize: 15, color: C.text1, flex: 1 },
  eyeBtn: { padding: 4 },
  submitBtn: {
    height: 56, backgroundColor: C.navyPrimary, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: C.navyDark, shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff', letterSpacing: -0.2 },
  doneWrap: { flex: 1, alignItems: 'center', backgroundColor: C.surface, gap: 12 },
  doneIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  doneTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: C.text1 },
  doneSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3 },
});
