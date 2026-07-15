package com.fleettrack.media.model.dto;

import com.fleettrack.media.model.enums.PhotoType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
public class PhotoRegistrationRequest {

    @NotNull
    private Long tripId;

    // Optional — only sent for STOP_POD photos, to record which intermediate stop the
    // proof-of-delivery belongs to. Ignored (null) for destination POD / pre-dispatch.
    private Long stopId;

    @NotNull
    private String photoKey;

    @NotNull
    private PhotoType photoType;

    @NotNull
    private String mimeType;

    @NotNull
    private Long fileSizeBytes;

    private BigDecimal lat;

    private BigDecimal lng;

    private Instant takenAt;
}
