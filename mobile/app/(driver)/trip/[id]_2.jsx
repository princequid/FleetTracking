import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import api from '../../../services/api_1';
import { useTripStore } from '../../../store/tripStore_2';

export default function TripScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const podUploaded = useTripStore((state) => state.podUploaded);
  const activeTrip = useTripStore((state) => state.activeTrip);

  const [trip, setTrip] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [loading, setLoading] = useState(false);

  // Haversine formula to calculate distance between two coordinates in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  useEffect(() => {
    loadTrip();
    startLocationTracking();
  }, []);

  const loadTrip = async () => {
    try {
      const response = await api.get(`/trips/${id}`);
      setTrip(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load trip details');
    }
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);

      if (trip?.destinationLat && trip?.destinationLng) {
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          trip.destinationLat,
          trip.destinationLng
        );
        setDistanceToDestination(distance);
      }
    }
  };

  const handleMarkStarted = async () => {
    setLoading(true);
    try {
      await api.put(`/trips/${id}/start`);
      Alert.alert('Success', 'Trip started');
      loadTrip();
    } catch (error) {
      Alert.alert('Error', 'Failed to start trip');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkArrived = async () => {
    setLoading(true);
    try {
      await api.put(`/trips/${id}/arrive`);
      Alert.alert('Success', 'Trip arrived');
      loadTrip();
    } catch (error) {
      Alert.alert('Error', 'Failed to mark as arrived');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!podUploaded) {
      Alert.alert('Error', 'POD must be uploaded before completing trip');
      return;
    }

    setLoading(true);
    try {
      await api.put(`/trips/${id}/complete`);
      Alert.alert('Success', 'Trip completed');
      router.replace('/driver/dashboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to complete trip');
    } finally {
      setLoading(false);
    }
  };

  const isNearDestination = distanceToDestination !== null && distanceToDestination < 200;

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text>Loading trip...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trip Details</Text>
      <Text style={styles.subtitle}>Trip ID: {id}</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.label}>Origin:</Text>
        <Text style={styles.value}>{trip.originAddress || 'Loading...'}</Text>

        <Text style={styles.label}>Destination:</Text>
        <Text style={styles.value}>{trip.destinationAddress || 'Loading...'}</Text>

        <Text style={styles.label}>ETA:</Text>
        <Text style={styles.value}>{trip.eta || 'Calculating...'}</Text>

        {distanceToDestination !== null && (
          <>
            <Text style={styles.label}>Distance to Destination:</Text>
            <Text style={styles.value}>{Math.round(distanceToDestination)}m</Text>
          </>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Mark Started"
          onPress={handleMarkStarted}
          disabled={loading || trip.status !== 'ASSIGNED'}
        />

        <Button
          title="Mark Arrived"
          onPress={handleMarkArrived}
          disabled={loading || !isNearDestination || trip.status !== 'IN_PROGRESS'}
        />

        <Button
          title="Capture POD"
          onPress={() => router.push(`/delivery/pod/${id}`)}
          disabled={trip.status !== 'IN_PROGRESS'}
        />

        <Button
          title="Complete Trip"
          onPress={handleCompleteTrip}
          disabled={loading || !podUploaded || trip.status !== 'ARRIVED'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  infoContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  value: {
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    gap: 10,
  },
});
