package com.fleettrack.incident.model.dto;

import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentType;
import jakarta.validation.constraints.NotNull;
<<<<<<< HEAD
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
=======
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
public class CreateIncidentRequest {

    @NotNull
    private Long tripId;

    @NotNull
<<<<<<< HEAD
=======
    private Long driverId;

    @NotNull
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
    private IncidentType incidentType;

    @NotNull
    private IncidentSeverity severity;

<<<<<<< HEAD
    @Size(max = 1000)
=======
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
    private String description;
}
