package com.fleettrack.trip.model.dto;

import lombok.Data;

/**
 * Body of PUT /trips/{id}/route — the road-following route geometry the driver app
 * computed (GeoJSON-style JSON string: {"type":"LineString","coordinates":[[lng,lat],...]}).
 */
@Data
public class RouteUpdateRequest {
    private String routeGeometry;
}
