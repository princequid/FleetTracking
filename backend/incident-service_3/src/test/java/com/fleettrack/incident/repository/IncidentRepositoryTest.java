package com.fleettrack.incident.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.fleettrack.incident.model.entity.Incident;
import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.model.enums.IncidentType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.jdbc.Sql;

@DataJpaTest
@Sql(statements = "CREATE SCHEMA IF NOT EXISTS incident")
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:incidentdb;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.default_schema=incident",
    "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
    "spring.flyway.enabled=false"
})
class IncidentRepositoryTest {

    @Autowired
    private IncidentRepository incidentRepository;

    @Test
    void shouldSaveAndFindIncidentsByTripSeverityAndStatus() {
        Incident incident = new Incident();
        incident.setTripId(101L);
        incident.setDriverId(202L);
        incident.setIncidentType(IncidentType.ACCIDENT);
        incident.setSeverity(IncidentSeverity.HIGH);
        incident.setDescription("Vehicle collision near checkpoint");
        incident.setStatus(IncidentStatus.OPEN);

        Incident saved = incidentRepository.saveAndFlush(incident);

        assertThat(saved.getId()).isNotNull();
        assertThat(incidentRepository.findByTripId(101L)).hasSize(1);
        assertThat(incidentRepository.findBySeverity(IncidentSeverity.HIGH)).hasSize(1);
        assertThat(incidentRepository.findByStatus(IncidentStatus.OPEN)).hasSize(1);
    }
}
