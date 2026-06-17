package com.fleettrack.auth.model.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ValidateResponse {
    private Long userId;
    private String role;
    private String email;
}
