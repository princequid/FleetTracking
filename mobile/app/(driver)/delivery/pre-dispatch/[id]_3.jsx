import React, { useState, useRef } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { mediaService } from '../../../services/mediaService_3';
import { useTripStore } from '../../../store/tripStore_2';

export default function PreDispatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const setActiveTrip = useTripStore((state) => state.setActiveTrip);

  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  const handleCapture = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission denied', 'Camera permission is required');
        return;
      }
    }

    // Get location
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    } catch (error) {
      Alert.alert('Location Error', 'Failed to get current location');
      return;
    }

    // Capture photo
    try {
      setLoading(true);
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync();
        
        // Upload with full flow
        await mediaService.fullUploadFlow(
          parseInt(id),
          'PRE_DISPATCH',
          photo.uri,
          location?.coords
        );

        // Set active trip and navigate
        setActiveTrip({ id: parseInt(id) });
        router.replace(`/trip/${id}`);
      }
    } catch (error) {
      Alert.alert('Upload Failed', error.message || 'Failed to capture and upload photo');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is required</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pre-Dispatch Photo</Text>
      <Text style={styles.subtitle}>Trip ID: {id}</Text>

      <CameraView style={styles.camera} ref={cameraRef} />

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loading} />
      ) : (
        <Button title="Capture & Upload" onPress={handleCapture} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  camera: {
    width: '100%',
    height: 400,
    marginBottom: 20,
    borderRadius: 10,
  },
  loading: {
    marginVertical: 20,
  },
  message: {
    fontSize: 16,
    marginBottom: 20,
  },
});
