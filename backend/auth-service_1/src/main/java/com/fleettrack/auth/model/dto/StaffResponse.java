package com.fleettrack.auth.model.dto;

import com.fleettrack.auth.model.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
@AllArgsConstructor
public class StaffResponse {
    private Long id;
    private String email;
    private Role role;
    private Instant createdAt;
}
