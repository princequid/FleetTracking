import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
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

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function PODScreen() {
  const router = useRouter();
  const { id }  = useLocalSearchParams();
  const tripId  = String(id).replace('_3', '');
  const setPodUploaded = useTripStore((s) => s.setPodUploaded);

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

  const showError = (msg) => {
    setError(msg);
    Animated.timing(errorOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(errorOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setError(''));
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
      const snap = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setPhoto(snap.uri);
      Animated.parallel([
        Animated.timing(previewOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(previewScale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
      ]).start();
    } catch (_) {
      showError('Failed to capture. Try again.');
    }
  };

  const retake = () => {
    setPhoto(null);
    Animated.parallel([
      Animated.timing(previewOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(previewScale, { toValue: 0.92, duration: 200, useNativeDriver: true }),
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
      await mediaService.fullUploadFlow(parseInt(tripId), 'POD', photo, coords);
      setPodUploaded(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (_) {
      showError('Upload failed. Check connection and retry.');
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
        <Text style={styles.permSub}>Proof of delivery photos require camera access</Text>
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
          <Text style={styles.stepBadge}>Step 4 of 5</Text>
          <Text style={styles.stepTitle}>Proof of Delivery</Text>
          <Text style={styles.stepHint}>Photo of the delivered cargo / signed receipt</Text>
        </View>
        <View style={styles.podBadge}>
          <Feather name="shield-off" size={12} color={C.amber} />
          <Text style={styles.podBadgeText}>Required to complete trip</Text>
        </View>
      </View>

      {!!error && (
        <Animated.View style={[styles.errorToast, { opacity: errorOpacity }]}>
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
                <View style={[styles.shutterInner, { backgroundColor: C.green }]} />
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
              <Text style={styles.useBtnText}>{loading ? 'Uploading…' : 'Confirm POD'}</Text>
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
  stepBadge: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: '#86EFAC', letterSpacing: 0.6 },
  stepTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: '#fff' },
  stepHint:  { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  podBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(217,119,6,0.2)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  podBadgeText: { fontFamily: 'Inter-Medium', fontSize: 12, color: C.amber },
  errorToast: {
    position: 'absolute', top: 180, alignSelf: 'center',
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
  sideBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28 },
  confirmRow: { flexDirection: 'row', gap: 12 },
  retakeBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  retakeBtnText: { fontFamily: 'Inter-Medium', fontSize: 15, color: '#fff' },
  useBtn: { flex: 2, height: 52, borderRadius: 14, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  useBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
});
