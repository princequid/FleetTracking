package com.fleettrack.notification.model.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DeviceTokenRequest {
    private Long recipientId;   // driver/user id these notifications are addressed to
    private String token;       // FCM (Android) / APNs (iOS) device token
    private String platform;    // "android" | "ios"
}
