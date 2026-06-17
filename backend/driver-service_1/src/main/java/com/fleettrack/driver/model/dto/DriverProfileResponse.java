package com.fleettrack.driver.model.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class DriverProfileResponse {
    private Long id;
    private Long userId;
    private String fullName;
    private String phone;
    private String licenceNo;
    private Boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;
}
