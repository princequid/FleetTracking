package com.fleettrack.driver.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DriverProfileRequest {

    @NotNull
    private Long userId;

    @NotBlank
    private String fullName;

    private String phone;

    private String licenceNo;
}
