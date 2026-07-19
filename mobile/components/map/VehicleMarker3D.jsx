import React from 'react';
import Pin3D from './Pin3D';

const DRIVER_BLUE = '#1677FF';

/**
 * Driver marker for the map — the electric-blue pin in the FleetTrack marker
 * family (see components/map/Pin3D.jsx). Kept as its own component since it's
 * a distinct role from the trip pins (start/stop/destination): larger, with a
 * soft glow halo, so it stays the most prominent thing on the map.
 *
 * Not directional — like the other pins on this map, it's anchored by its
 * point and doesn't rotate with the driver's heading.
 */
export default function VehicleMarker3D({ size = 52 }) {
  return <Pin3D color={DRIVER_BLUE} size={size} glow />;
}
