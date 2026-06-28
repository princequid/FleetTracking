package com.fleettrack.media.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresignResponse {
    private String uploadUrl;
    private String photoKey;
    private Integer expiresIn = 900;
}
