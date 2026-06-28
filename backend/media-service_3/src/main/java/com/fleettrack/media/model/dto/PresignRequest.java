package com.fleettrack.media.model.dto;

import com.fleettrack.media.model.enums.PhotoType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PresignRequest {

    @NotNull
    private Long tripId;

    @NotNull
    private PhotoType photoType;

    @NotNull
    private String mimeType;
}
