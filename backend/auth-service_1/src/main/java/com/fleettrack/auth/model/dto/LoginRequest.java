package com.fleettrack.auth.model.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String password;

    // Optional. Mobile sends a UUID persisted in SecureStore; the admin portal
    // (web) doesn't send one yet, so new-device tracking is currently mobile-only.
    private String deviceFingerprint;
}
