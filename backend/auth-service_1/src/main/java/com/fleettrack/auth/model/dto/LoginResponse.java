package com.fleettrack.auth.model.dto;

import com.fleettrack.auth.model.enums.Role;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginResponse {

    private String accessToken;
    private String refreshToken;

    @Builder.Default
    private String tokenType = "Bearer";

    private Role role;
    private Long userId;

    // True once, right after an admin-created account's first successful login —
    // prompts the mobile app to offer changing the password the admin set.
    private Boolean mustChangePassword;
}
