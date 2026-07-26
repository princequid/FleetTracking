import React from 'react';
import Pin3D from './Pin3D';

const DRIVER_BLUE = '#1677FF';

/**
 * Driver marker for the map — the electric-blue teardrop pin, larger than the trip pins
 * so it stays the most prominent thing on the map.
 *
 * iOS only. Android renders a native Google Maps pin instead (see the driver Marker in
 * app/(driver)/trip/[id]/map.jsx), because Android rasterises custom marker views into a
 * bitmap and doesn't reliably capture SVG — a native pin sidesteps that entirely.
 *
 * Not directional — anchored by its point on the coordinate, doesn't rotate with heading.
 */
export default function VehicleMarker3D({ size = 52 }) {
  return <Pin3D color={DRIVER_BLUE} size={size} hole={false} />;
}
