import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  StyleSheet, Dimensions, KeyboardAvoidingView, Platform, ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { authService } from '../../services/authService_1';
import { useAuthStore } from '../../store/authStore_1';
import { useTheme } from '../../theme/ThemeContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
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
      const { userId, role, email: userEmail, mustChangePassword } = await authService.login(email, password);
      Animated.spring(btnScale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }).start();
      setLoggedIn(userId, role, userEmail);
      router.replace(mustChangePassword ? '/(driver)/first-login' : '/(driver)/dashboard_2');
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
    ? { borderColor: C.navyPrimary, backgroundColor: C.surface }
    : { borderColor: C.border, backgroundColor: C.bg };

  const pwStyle = passwordFocused
    ? { borderColor: C.navyPrimary, backgroundColor: C.surface }
    : { borderColor: C.border, backgroundColor: C.bg };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: C.surface }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={[styles.topSection, { paddingTop: Math.max(60, insets.top + 20) }]}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Image source={require('../../assets/icon.png')} style={styles.brandIconImage} resizeMode="contain" />
            </View>
            <View>
              <Text style={styles.brandName}>FleetSync</Text>
              <Text style={styles.brandPortal}>Driver Portal</Text>
            </View>
          </View>
          <Text style={styles.heroLine}>
            Welcome back,{'\n'}<Text style={styles.heroAccent}>driver.</Text>
          </Text>
          <Text style={styles.heroSub}>Sign in to your account to continue your shifts</Text>
        </View>

        <View style={[styles.bottomSection, { paddingBottom: Math.max(40, insets.bottom + 16) }]}>
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
                  <LoadingSpinner color="#fff" />
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

const makeStyles = (C) => StyleSheet.create({
  topSection: {
    backgroundColor: C.navyDark,
    paddingTop: 60, paddingBottom: 40, paddingHorizontal: 28,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    gap: 16, minHeight: height * 0.42, justifyContent: 'flex-end',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  brandIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  brandIconImage: { width: 34, height: 34 },
  brandName:   { fontFamily: 'Inter-ExtraBold', fontSize: 21, color: '#fff', letterSpacing: -0.3 },
  brandPortal: { fontFamily: 'Inter-Medium', fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  heroLine:    { fontFamily: 'Inter-Bold', fontSize: 24, color: '#fff', lineHeight: 32 },
  heroAccent:  { color: C.tealLight },
  heroSub:     { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },
  bottomSection: {
    flex: 1, backgroundColor: C.surface,
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
});
