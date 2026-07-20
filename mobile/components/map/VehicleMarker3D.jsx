import React from 'react';
import { View, StyleSheet } from 'react-native';

const DRIVER_BLUE = '#1677FF';

/**
 * Driver marker for the map — the electric-blue pin in the FleetTrack marker family.
 *
 * Built from plain React Native Views (NOT react-native-svg). On Android,
 * react-native-maps rasterises each custom marker's child into a bitmap, and
 * react-native-svg content is unreliable to snapshot there (it renders blank or
 * clipped) — plain Views always rasterise correctly, which is what keeps this pin
 * (and the start/stop/destination pins) visible and complete on Android.
 *
 * It's the most prominent marker on the map: larger head + a soft glow halo.
 * Not directional — anchored by its point, doesn't rotate with heading.
 */
export default function VehicleMarker3D() {
  return (
    <View style={s.wrap} collapsable={false}>
      <View style={s.headWrap} collapsable={false}>
        <View style={s.glow} collapsable={false} />
        <View style={s.head} collapsable={false}>
          <View style={s.gloss} collapsable={false} />
          <View style={s.centerDot} collapsable={false} />
        </View>
      </View>
      <View style={s.point} collapsable={false} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  headWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(22,119,255,0.20)',
  },
  head: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DRIVER_BLUE,
    borderWidth: 3.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 7,
  },
  gloss: {
    position: 'absolute', top: 5,
    width: 17, height: 8, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  centerDot: {
    width: 11, height: 11, borderRadius: 6, backgroundColor: '#fff',
  },
  point: {
    width: 0, height: 0, marginTop: -4,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: DRIVER_BLUE,
  },
});
