# Stage 1: Build shared-events library
FROM maven:3.9.6-eclipse-temurin-17 AS shared-events-build
WORKDIR /shared-events
COPY shared-events_5/pom.xml .
COPY shared-events_5/src ./src
RUN mvn clean install -DskipTests -q -Dmaven.wagon.http.retryHandler.count=5 -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 -Dmaven.wagon.rto=60000

# Stage 2: Build incident-service
FROM shared-events-build AS build
WORKDIR /app
COPY incident-service_3/pom.xml .
RUN mvn dependency:go-offline -q -Dmaven.wagon.http.retryHandler.count=5 -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 -Dmaven.wagon.rto=60000
COPY incident-service_3/src ./src
RUN mvn clean package -DskipTests -q -Dmaven.wagon.http.retryHandler.count=5 -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 -Dmaven.wagon.rto=60000

# Stage 3: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8087
# Run as an unprivileged user. eclipse-temurin defaults to UID 0, so an RCE in
# a Spring service otherwise yields root inside the container. Also required by
# the Kubernetes "restricted" PodSecurityStandard (runAsNonRoot).
RUN addgroup -S spring && adduser -S spring -G spring && chown -R spring:spring /app
USER spring:spring

ENTRYPOINT ["java", "-jar", "app.jar"]
