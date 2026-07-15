package com.fleettrack.trip.client;

import com.fleettrack.trip.model.dto.MediaPodStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
public class MediaServiceClient {

    private final RestTemplate restTemplate;

    public boolean hasPodPhoto(Long tripId) {
        return Boolean.TRUE.equals(getPodStatus(tripId).getHasPOD());
    }

    public MediaPodStatusResponse getPodStatus(Long tripId) {
        try {
            MediaPodStatusResponse response = restTemplate.getForObject(
                    "http://media-service/photos/trips/" + tripId + "/status",
                    MediaPodStatusResponse.class
            );
            return response != null ? response : new MediaPodStatusResponse();
        } catch (Exception e) {
            throw new RuntimeException("Media service unavailable — cannot verify POD photo");
        }
    }
}
