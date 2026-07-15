package com.fleettrack.media.model.dto;

import com.fleettrack.media.model.enums.PhotoType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class PhotoResponse {
    private Long id;
    private Long tripId;
    private Long stopId;
    private String photoUrl;
    private PhotoType photoType;
    private String sha256Hash;
    private Instant uploadedAt;
}
