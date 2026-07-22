package com.fleettrack.notification.client;

import lombok.Data;

/** Mirrors auth-service's StaffResponse — only the fields this service needs. */
@Data
public class StaffMember {
    private Long id;
    private String email;
    private String role;
}
