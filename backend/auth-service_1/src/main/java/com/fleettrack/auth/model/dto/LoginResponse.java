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
}
