package com.fleettrack.driver.exception;

/**
 * Thrown when a driver profile lookup by id/userId fails to find a match.
 * Mapped to HTTP 404 by {@link GlobalExceptionHandler}, distinct from the generic
 * {@link RuntimeException}-to-400 mapping used for other error cases (e.g. "already exists").
 */
public class DriverNotFoundException extends RuntimeException {
    public DriverNotFoundException(String message) {
        super(message);
    }
}
