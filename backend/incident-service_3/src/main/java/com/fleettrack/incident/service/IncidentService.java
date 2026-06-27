package com.fleettrack.incident.service;

import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.dto.IncidentResponse;
import com.fleettrack.incident.model.dto.UpdateStatusRequest;
import com.fleettrack.incident.model.entity.Incident;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;

    @Transactional
    public IncidentResponse createIncident(CreateIncidentRequest request) {
        Incident incident = new Incident();
        incident.setTripId(request.getTripId());
        incident.setDriverId(request.getDriverId());
        incident.setIncidentType(request.getIncidentType());
        incident.setSeverity(request.getSeverity());
        incident.setDescription(request.getDescription());
        incident.setStatus(IncidentStatus.OPEN);
        return mapToResponse(incidentRepository.save(incident));
    }

    public List<IncidentResponse> getAllIncidents() {
        return incidentRepository.findAll().stream()
                .map(this::mapToResponse)
                .toList();
    }

    public List<IncidentResponse> getIncidentsByTripId(Long tripId) {
        return incidentRepository.findByTripId(tripId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    public List<IncidentResponse> getIncidentsByStatus(IncidentStatus status) {
        return incidentRepository.findByStatus(status).stream()
                .map(this::mapToResponse)
                .toList();
    }

    public IncidentResponse getIncidentById(Long id) {
        return incidentRepository.findById(id)
                .map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("Incident not found"));
    }

    @Transactional
    public IncidentResponse updateStatus(Long id, UpdateStatusRequest request, Long reviewerId) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Incident not found"));

        incident.setStatus(request.getStatus());
        incident.setReviewedBy(reviewerId);

        if (request.getResolutionNotes() != null) {
            incident.setResolutionNotes(request.getResolutionNotes());
        }

        if (request.getStatus() == IncidentStatus.RESOLVED || request.getStatus() == IncidentStatus.DISMISSED) {
            incident.setResolvedAt(OffsetDateTime.now());
        }

        return mapToResponse(incidentRepository.save(incident));
    }

    private IncidentResponse mapToResponse(Incident incident) {
        return IncidentResponse.builder()
                .id(incident.getId())
                .tripId(incident.getTripId())
                .driverId(incident.getDriverId())
                .incidentType(incident.getIncidentType())
                .severity(incident.getSeverity())
                .description(incident.getDescription())
                .status(incident.getStatus())
                .reviewedBy(incident.getReviewedBy())
                .resolutionNotes(incident.getResolutionNotes())
                .resolvedAt(incident.getResolvedAt())
                .createdAt(incident.getCreatedAt())
                .build();
    }
}
