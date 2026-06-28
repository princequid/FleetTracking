import java.sql.*;
public class FlywayRepair {
  public static void main(String[] args) throws Exception {
    Class.forName("org.postgresql.Driver");
    String url = "jdbc:postgresql://localhost:5433/fleettrack";
    try (Connection conn = DriverManager.getConnection(url, "fleettrack", "fleettrack")) {
      try (Statement st = conn.createStatement()) {
        st.execute("CREATE SCHEMA IF NOT EXISTS incident");
        st.execute("CREATE TABLE IF NOT EXISTS incident.flyway_schema_history (installed_rank INT PRIMARY KEY, version VARCHAR(50), description TEXT, type VARCHAR(20), script TEXT, checksum INTEGER, installed_by VARCHAR(100), installed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP, execution_time INT, success BOOLEAN)");
        st.execute("DELETE FROM incident.flyway_schema_history WHERE version = '1'");
        st.execute("INSERT INTO incident.flyway_schema_history(installed_rank, version, description, type, script, checksum, installed_by, execution_time, success) VALUES (1, '1', 'create incident tables', 'SQL', 'V1__create_incident_tables.sql', -200142528, 'fleettrack', 0, true)");
      }
      System.out.println("flyway repair complete");
    }
  }
}
