package com.fleettrack.media.model.enums;

public enum PhotoType {
    PRE_DISPATCH,
    POD,
    // Optional proof-of-delivery captured at an intermediate stop (waypoint) on a
    // multi-stop trip. Deliberately DISTINCT from POD so it never satisfies the
    // final-destination POD gate that unlocks trip completion (see MediaService.hasPOD,
    // which matches PhotoType.POD only).
    STOP_POD,
    INCIDENT,
    PROFILE
}
