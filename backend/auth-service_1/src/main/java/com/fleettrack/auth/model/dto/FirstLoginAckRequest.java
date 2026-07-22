package com.fleettrack.auth.model.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** newPassword is optional — omit/blank it to keep the current password. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FirstLoginAckRequest {
    private String newPassword;
}
