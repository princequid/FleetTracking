import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions,
  Image, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { mediaService } from '../../../../services/mediaService_3';
import { useTripStore } from '../../../../store/tripStore_2';
import { C } from '../../../../constants/colors';

const { width, height } = Dimensions.get('window');
const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function PreDispatchScreen() {
  const router = useRouter();
  const { id }  = useLocalSearchParams();
  const tripId  = String(id).replace('_3', '');
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);

  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [facing, setFacing]   = useState('back');
  const [error, setError]     = useState('');
  const cameraRef = useRef(null);

  const btnScale       = useRef(new Animated.Value(1)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewScale   = useRef(new Animated.Value(0.92)).current;
  const errorOpacity   = useRef(new Animated.Value(0)).current;
  const errorTransY    = useRef(new Animated.Value(-8)).current;

  const showError = (msg) => {
    setError(msg);
    Animated.parallel([
      Animated.timing(errorOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(errorTransY,  { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(errorOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(errorTransY,  { toValue: -8, duration: 300, useNativeDriver: true }),
      ]).start(() => setError(''));
    }, 3500);
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.9, damping: 10, stiffness: 200, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1,   damping: 10, stiffness: 200, useNativeDriver: true }),
    ]).start();
    try {
      const snap = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setPhoto(snap.uri);
      Animated.parallel([
        Animated.timing(previewOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(previewScale,   { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
      ]).start();
    } catch (_) {
      showError('Failed to take photo. Try again.');
    }
  };

  const retake = () => {
    setPhoto(null);
    Animated.parallel([
      Animated.timing(previewOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(previewScale,   { toValue: 0.92, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const confirmUpload = async () => {
    if (!photo || loading) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const locResult = await Location.requestForegroundPermissionsAsync();
      let coords = null;
      if (locResult.status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        coords = loc.coords;
      }
      await mediaService.fullUploadFlow(parseInt(tripId), 'PRE_DISPATCH', photo, coords);
      setActiveTrip({ id: parseInt(tripId) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/(driver)/trip/${tripId}_2`);
    } catch (err) {
      showError('Upload failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.permWrap}>
        <Text style={styles.permText}>Checking camera permissions…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permWrap}>
        <Feather name="camera-off" size={44} color={C.text3} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permSub}>Pre-dispatch photos require camera permission</Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Grant permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {!photo ? (
        <CameraView style={StyleSheet.absoluteFill} facing={facing} ref={cameraRef} />
      ) : (
        <AnimatedImage
          source={{ uri: photo }}
          style={[StyleSheet.absoluteFill, { resizeMode: 'cover' }, { opacity: previewOpacity, transform: [{ scale: previewScale }] }]}
        />
      )}

      <View style={styles.topOverlay}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.stepInfo}>
          <Text style={styles.stepBadge}>Step 1 of 5</Text>
          <Text style={styles.stepTitle}>Pre-dispatch photo</Text>
          <Text style={styles.stepHint}>Photograph the cargo / vehicle before starting the trip</Text>
        </View>
      </View>

      {!!error && (
        <Animated.View style={[styles.errorToast, { opacity: errorOpacity, transform: [{ translateY: errorTransY }] }]}>
          <Feather name="alert-circle" size={14} color={C.red} />
          <Text style={styles.errorToastText}>{error}</Text>
        </Animated.View>
      )}

      <View style={styles.bottomOverlay}>
        {!photo ? (
          <View style={styles.captureRow}>
            <TouchableOpacity style={styles.sideBtn} onPress={() => setFacing((f) => f === 'back' ? 'front' : 'back')}>
              <Feather name="refresh-cw" size={20} color="#fff" />
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity style={styles.shutter} onPress={capture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.sideBtn} />
          </View>
        ) : (
          <View style={styles.confirmRow}>
            <TouchableOpacity style={styles.retakeBtn} onPress={retake}>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.useBtn, loading && { opacity: 0.7 }]}
              onPress={confirmUpload}
              disabled={loading}
            >
              <Text style={styles.useBtnText}>{loading ? 'Uploading…' : 'Use photo'}</Text>
              {!loading && <Feather name="check" size={16} color="#fff" style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permWrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  permTitle: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: C.text1 },
  permSub:   { fontFamily: 'Inter-Regular',  fontSize: 14, color: C.text3, textAlign: 'center', lineHeight: 22 },
  permText:  { fontFamily: 'Inter-Regular',  fontSize: 14, color: C.text3 },
  grantBtn:  { marginTop: 8, backgroundColor: C.navyPrimary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  grantBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 48, paddingHorizontal: 20, paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.55)', gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
  },
  stepInfo: { gap: 4 },
  stepBadge: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.tealLight, letterSpacing: 0.6 },
  stepTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: '#fff' },
  stepHint:  { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  errorToast: {
    position: 'absolute', top: 160, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  errorToastText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.red },
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 50, paddingTop: 24, paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  confirmRow: { flexDirection: 'row', gap: 12 },
  retakeBtn: {
    flex: 1, height: 52, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  retakeBtnText: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#fff' },
  useBtn: { flex: 2, height: 52, borderRadius: 14, backgroundColor: C.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  useBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
});
