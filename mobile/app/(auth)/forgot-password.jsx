import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Dimensions, KeyboardAvoidingView, Platform, ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api_1';
import { useTheme } from '../../theme/ThemeContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { height } = Dimensions.get('window');

// Requests a reset link — POST /auth/forgot-password always returns 200 regardless
// of whether the email is registered (so this screen can't be used to enumerate
// accounts), which is why the success state below is deliberately non-committal
// ("if that email is registered...") rather than confirming anything either way.
export default function ForgotPasswordScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);

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
    if (!email.trim()) { showError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      if (err.code === 'ECONNABORTED' || !err.response) {
        showError('Cannot reach server. Check your network connection.');
      } else {
        showError('Something went wrong — please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.doneWrap, { paddingTop: insets.top + 40 }]}>
        <View style={styles.doneIcon}>
          <Feather name="mail" size={26} color="#fff" />
        </View>
        <Text style={styles.doneTitle}>Check your email</Text>
        <Text style={styles.doneSub}>
          If {email.trim()} is registered, we've sent a link to reset your password.
        </Text>
        <TouchableOpacity style={styles.doneBackBtn} onPress={() => router.replace('/(auth)/login_1')}>
          <Text style={styles.doneBackText}>Back to sign in</Text>
        </TouchableOpacity>
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
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.heroLine}>Forgot your{'\n'}<Text style={styles.heroAccent}>password?</Text></Text>
          <Text style={styles.heroSub}>Enter your email and we'll send you a link to reset it.</Text>
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
              <Text style={styles.label}>Email address</Text>
              <View style={[styles.inputWrap, { borderColor: C.border, backgroundColor: C.bg }]}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
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
              {loading ? <LoadingSpinner color="#fff" /> : <Text style={styles.submitText}>Send reset link</Text>}
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
  backBtn: {
    position: 'absolute', left: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
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
  submitBtn: {
    height: 56, backgroundColor: C.navyPrimary, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: C.navyDark, shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff', letterSpacing: -0.2 },
  doneWrap: { flex: 1, alignItems: 'center', backgroundColor: C.surface, gap: 12, paddingHorizontal: 32 },
  doneIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  doneTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: C.text1 },
  doneSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3, textAlign: 'center', lineHeight: 19 },
  doneBackBtn: { marginTop: 8, padding: 10 },
  doneBackText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.navyPrimary },
});
