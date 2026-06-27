package com.fleettrack.incident.service;

import com.fleettrack.incident.event.IncidentEventPublisher;
import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.dto.IncidentResponse;
import com.fleettrack.incident.model.dto.UpdateIncidentStatusRequest;
import com.fleettrack.incident.model.entity.Incident;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final IncidentEventPublisher incidentEventPublisher;

    @Transactional
    public IncidentResponse reportIncident(CreateIncidentRequest request, Long driverId) {
        Incident incident = Incident.builder()
                .tripId(request.getTripId())
                .driverId(driverId)
                .incidentType(request.getIncidentType())
                .severity(request.getSeverity())
                .description(request.getDescription())
                .status(IncidentStatus.OPEN)
                .build();

        Incident saved = incidentRepository.save(incident);
        incidentEventPublisher.publishIncidentReported(saved);
        return toResponse(saved);
    }

    public List<IncidentResponse> getAllIncidents(IncidentStatus status) {
        if (status == null) {
            return incidentRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
        }
        return incidentRepository.findByStatus(status).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<IncidentResponse> getIncidentsByTrip(Long tripId) {
        return incidentRepository.findByTripId(tripId).stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public IncidentResponse updateStatus(Long id, UpdateIncidentStatusRequest request, Long adminUserId) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));

        IncidentStatus newStatus = request.getStatus();
        if (incident.getStatus() == IncidentStatus.RESOLVED || incident.getStatus() == IncidentStatus.DISMISSED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incident is already closed");
        }

        if (!isValidTransition(incident.getStatus(), newStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status transition");
        }

        incident.setStatus(newStatus);
        incident.setReviewedBy(adminUserId);
        incident.setResolutionNotes(request.getResolutionNotes());
        if (newStatus == IncidentStatus.RESOLVED) {
            incident.setResolvedAt(Instant.now());
        } else if (newStatus == IncidentStatus.DISMISSED) {
            incident.setResolvedAt(null);
        }

        return toResponse(incidentRepository.save(incident));
    }

    private boolean isValidTransition(IncidentStatus current, IncidentStatus next) {
        if (current == null) {
            return next == IncidentStatus.OPEN;
        }
        return switch (current) {
            case OPEN -> next == IncidentStatus.UNDER_REVIEW;
            case UNDER_REVIEW -> next == IncidentStatus.RESOLVED || next == IncidentStatus.DISMISSED;
            case RESOLVED, DISMISSED -> false;
        };
    }

    private IncidentResponse toResponse(Incident incident) {
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
