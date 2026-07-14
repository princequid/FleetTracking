package com.fleettrack.trip.exception;

/**
 * Thrown when a trip lookup by id finds no matching row. Kept distinct from a
 * generic RuntimeException so GlobalExceptionHandler can map it to 404 instead
 * of the default 400 used for bad-input errors.
 */
public class TripNotFoundException extends RuntimeException {
    public TripNotFoundException(String message) {
        super(message);
    }
}
