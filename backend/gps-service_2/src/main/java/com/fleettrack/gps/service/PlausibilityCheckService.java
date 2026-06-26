package com.fleettrack.gps.service;

import com.fleettrack.gps.model.entity.GpsPing;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class PlausibilityCheckService {

    private static final double EARTH_RADIUS_M = 6_371_000.0;
    private static final double MAX_SPEED_KMH = 180.0;
    private static final double TELEPORT_DISTANCE_M = 5_000.0;
    private static final long TELEPORT_TIME_SECONDS = 10;

    public String checkPing(GpsPing newPing, GpsPing previousPing) {
        if (previousPing == null) return null;

        double distanceM = haversine(
                previousPing.getLat().doubleValue(), previousPing.getLng().doubleValue(),
                newPing.getLat().doubleValue(), newPing.getLng().doubleValue()
        );

        long secondsBetween = Duration.between(previousPing.getRecordedAt(), newPing.getRecordedAt()).getSeconds();
        if (secondsBetween <= 0) return null;

        if (distanceM > TELEPORT_DISTANCE_M && secondsBetween < TELEPORT_TIME_SECONDS) {
            return "TELEPORT_DETECTED";
        }

        double impliedSpeedKmh = (distanceM / secondsBetween) * 3.6;
        if (impliedSpeedKmh > MAX_SPEED_KMH) {
            return "IMPLAUSIBLE_SPEED";
        }

        return null;
    }

    public static double haversine(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_M * c;
    }
}
