import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Dimensions, KeyboardAvoidingView, Platform, ScrollView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { authService } from '../../services/authService_1';
import { useAuthStore } from '../../store/authStore_1';
import { C } from '../../constants/colors';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const router  = useRouter();
  const setLoggedIn = useAuthStore((s) => s.setLoggedIn);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [emailFocused, setEmailFocused]       = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const formShake    = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;

  const showError = (msg) => {
    setError(msg);
    Animated.timing(errorOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.timing(formShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue:  8, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue:  6, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue:  0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    Animated.spring(btnScale, { toValue: 0.97, damping: 10, stiffness: 200, useNativeDriver: true }).start();
    try {
      const { userId, role, email: userEmail } = await authService.login(email, password);
      Animated.spring(btnScale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }).start();
      setLoggedIn(userId, role, userEmail);
      router.replace('/(driver)/dashboard_2');
    } catch (err) {
      Animated.spring(btnScale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }).start();
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        showError('Cannot reach server. Check your network connection.');
      } else if (!err.response) {
        showError('Cannot reach server. Check your network connection.');
      } else {
        showError(err.response.data?.error || err.response.data?.message || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const emailStyle = emailFocused
    ? { borderColor: C.navyPrimary, backgroundColor: '#fff' }
    : { borderColor: C.border, backgroundColor: '#F3F4F6' };

  const pwStyle = passwordFocused
    ? { borderColor: C.navyPrimary, backgroundColor: '#fff' }
    : { borderColor: C.border, backgroundColor: '#F3F4F6' };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.topSection}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Feather name="truck" size={16} color="#fff" />
            </View>
            <View>
              <Text style={styles.brandName}>FleetTrack Pro</Text>
              <Text style={styles.brandPortal}>Driver Portal</Text>
            </View>
          </View>
          <Text style={styles.heroLine}>
            Welcome back,{'\n'}<Text style={styles.heroAccent}>driver.</Text>
          </Text>
          <Text style={styles.heroSub}>Sign in to your account to continue your shifts</Text>
        </View>

        <View style={styles.bottomSection}>
          <Animated.View style={{ transform: [{ translateX: formShake }] }}>
            {!!error && (
              <Animated.View style={[styles.errorBanner, { opacity: errorOpacity }]}>
                <Feather name="alert-circle" size={14} color={C.red} style={{ marginRight: 6 }} />
                <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
              </Animated.View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={[styles.inputWrap, emailStyle]}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={C.text3}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrap, pwStyle]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  placeholder="••••••••"
                  placeholderTextColor={C.text3}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPw((s) => !s)} style={styles.eyeBtn}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={C.text3} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[styles.signInBtn, loading && styles.signInBtnLoading]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <View style={styles.spinner} />
                ) : (
                  <Text style={styles.signInText}>Sign in</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topSection: {
    backgroundColor: C.navyDark,
    paddingTop: 60, paddingBottom: 40, paddingHorizontal: 28,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    gap: 16, minHeight: height * 0.42, justifyContent: 'flex-end',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  brandIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center',
  },
  brandName:   { fontFamily: 'Inter-Bold', fontSize: 15, color: '#fff' },
  brandPortal: { fontFamily: 'Inter-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  heroLine:    { fontFamily: 'Inter-Bold', fontSize: 24, color: '#fff', lineHeight: 32 },
  heroAccent:  { color: C.tealLight },
  heroSub:     { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },
  bottomSection: {
    flex: 1, backgroundColor: '#fff',
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.redLight, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 16,
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
  forgotRow: { alignItems: 'flex-end', marginBottom: 28, marginTop: -6 },
  forgotText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.teal },
  signInBtn: {
    height: 56, backgroundColor: C.navyPrimary, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.navyDark, shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  signInBtnLoading: { opacity: 0.8 },
  signInText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff', letterSpacing: -0.2 },
  spinner: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.35)', borderTopColor: '#fff',
  },
});
