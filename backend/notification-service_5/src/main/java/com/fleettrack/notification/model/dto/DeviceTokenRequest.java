package com.fleettrack.notification.model.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DeviceTokenRequest {
    // Intentionally no recipientId field: the recipient is always derived from the
    // authenticated caller's X-User-Id header (see DeviceController), never trusted
    // from the request body — otherwise any caller could register a token for an
    // arbitrary user and hijack their push notifications.
    private String token;       // FCM (Android) / APNs (iOS) device token
    private String platform;    // "android" | "ios"
}
