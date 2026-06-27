package com.fleettrack.incident.service;

<<<<<<< HEAD
import com.fleettrack.incident.event.IncidentEventPublisher;
import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.dto.IncidentResponse;
import com.fleettrack.incident.model.dto.UpdateIncidentStatusRequest;
=======
import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.dto.IncidentResponse;
import com.fleettrack.incident.model.dto.UpdateStatusRequest;
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
import com.fleettrack.incident.model.entity.Incident;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
<<<<<<< HEAD
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
=======
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
import java.util.List;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;
<<<<<<< HEAD
    private final IncidentEventPublisher incidentEventPublisher;

    @Transactional
    public IncidentResponse reportIncident(CreateIncidentRequest request, Long driverId) {
        Incident incident = new Incident();
        incident.setTripId(request.getTripId());
        incident.setDriverId(driverId);
=======

    @Transactional
    public IncidentResponse createIncident(CreateIncidentRequest request) {
        Incident incident = new Incident();
        incident.setTripId(request.getTripId());
        incident.setDriverId(request.getDriverId());
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
        incident.setIncidentType(request.getIncidentType());
        incident.setSeverity(request.getSeverity());
        incident.setDescription(request.getDescription());
        incident.setStatus(IncidentStatus.OPEN);
<<<<<<< HEAD

        Incident saved = incidentRepository.save(incident);
        incidentEventPublisher.publishIncidentReported(saved);
        return toResponse(saved);
    }

    public List<IncidentResponse> getAllIncidents(IncidentStatus status) {
        if (status == null) {
            return incidentRepository.findAll().stream().map(this::toResponse).toList();
        }
        return incidentRepository.findByStatus(status).stream().map(this::toResponse).toList();
    }

    public List<IncidentResponse> getIncidentsByTrip(Long tripId) {
        return incidentRepository.findByTripId(tripId).stream().map(this::toResponse).toList();
=======
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
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
    }

    public IncidentResponse getIncidentById(Long id) {
        return incidentRepository.findById(id)
<<<<<<< HEAD
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));
    }

    @Transactional
    public IncidentResponse updateStatus(Long id, UpdateIncidentStatusRequest request, Long adminUserId) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found"));

        if (incident.getStatus() == IncidentStatus.RESOLVED || incident.getStatus() == IncidentStatus.DISMISSED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incident is already closed");
        }

        IncidentStatus newStatus = request.getStatus();
        if (!isValidTransition(incident.getStatus(), newStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status transition");
        }

        incident.setStatus(newStatus);
        incident.setReviewedBy(adminUserId);
        incident.setResolutionNotes(request.getResolutionNotes());

        if (newStatus == IncidentStatus.RESOLVED || newStatus == IncidentStatus.DISMISSED) {
            incident.setResolvedAt(Instant.now());
        }

        return toResponse(incidentRepository.save(incident));
    }

    private boolean isValidTransition(IncidentStatus current, IncidentStatus next) {
        return switch (current) {
            case OPEN -> next == IncidentStatus.UNDER_REVIEW;
            case UNDER_REVIEW -> next == IncidentStatus.RESOLVED || next == IncidentStatus.DISMISSED;
            case RESOLVED, DISMISSED -> false;
        };
    }

    private IncidentResponse toResponse(Incident incident) {
=======
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
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
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
