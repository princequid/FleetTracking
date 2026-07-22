import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, SafeAreaView, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api_1';
import { useTheme } from '../../theme/ThemeContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Shown once, right after login, only when LoginResponse.mustChangePassword is true —
// i.e. the account's password was set by an admin (see DriverForm in the admin
// portal) and the driver hasn't set their own yet. Either choice below clears the
// flag server-side (PUT /auth/first-login-ack) so this screen never appears again.
export default function FirstLoginScreen() {
  const router = useRouter();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [changing,        setChanging]        = useState(false);
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword]  = useState('');
  const [showPw,          setShowPw]           = useState(false);
  const [loading,         setLoading]          = useState(false);
  const [error,           setError]            = useState('');

  const formShake = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(formShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue:  8, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue:  0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const acknowledge = async (newPassword) => {
    setLoading(true);
    setError('');
    try {
      await api.put('/auth/first-login-ack', { newPassword: newPassword || undefined });
      router.replace('/(driver)/dashboard_2');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong — please try again.');
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); shake(); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); shake(); return; }
    acknowledge(password);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Feather name="shield" size={26} color={C.navyPrimary} />
        </View>
        <Text style={styles.title}>Welcome to FleetSync</Text>
        <Text style={styles.sub}>
          Your account was set up for you. Would you like to choose your own password now?
        </Text>

        <Animated.View style={{ width: '100%', transform: [{ translateX: formShake }] }}>
          {!!error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={C.red} style={{ marginRight: 6 }} />
              <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
            </View>
          )}

          {changing ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>New password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPw}
                    placeholder="At least 8 characters"
                    placeholderTextColor={C.text3}
                  />
                  <Pressable onPress={() => setShowPw((s) => !s)} style={styles.eyeBtn}>
                    <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={C.text3} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPw}
                    placeholder="Re-enter your password"
                    placeholderTextColor={C.text3}
                    onSubmitEditing={handleSave}
                  />
                </View>
              </View>

              <Pressable style={[styles.primaryBtn, loading && { opacity: 0.8 }]} onPress={handleSave} disabled={loading}>
                {loading ? <LoadingSpinner color="#fff" /> : <Text style={styles.primaryBtnText}>Save new password</Text>}
              </Pressable>
              <Pressable style={styles.textBtn} onPress={() => setChanging(false)} disabled={loading}>
                <Text style={styles.textBtnText}>Back</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={[styles.primaryBtn, loading && { opacity: 0.8 }]} onPress={() => setChanging(true)} disabled={loading}>
                <Text style={styles.primaryBtnText}>Change my password</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => acknowledge(null)} disabled={loading}>
                {loading ? <LoadingSpinner color={C.navyPrimary} /> : <Text style={styles.secondaryBtnText}>Keep my current password</Text>}
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 48 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: C.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontFamily: 'Inter-Bold', fontSize: 20, color: C.text1, marginBottom: 8, textAlign: 'center' },
  sub: {
    fontFamily: 'Inter-Regular', fontSize: 14, color: C.text2,
    textAlign: 'center', lineHeight: 20, marginBottom: 28,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.redLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  errorText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.red, flex: 1 },
  fieldGroup: { marginBottom: 16, gap: 6 },
  label: { fontFamily: 'Inter-Medium', fontSize: 12, color: C.text2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface,
    paddingHorizontal: 14,
  },
  input: { height: 48, fontFamily: 'Inter-Regular', fontSize: 15, color: C.text1, flex: 1 },
  eyeBtn: { padding: 4 },
  primaryBtn: {
    height: 54, backgroundColor: C.navyPrimary, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  primaryBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
  secondaryBtn: {
    height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  secondaryBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.text2 },
  textBtn: { alignItems: 'center', justifyContent: 'center', marginTop: 16, padding: 8 },
  textBtnText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.text3 },
});
