# Stage 1: Build shared-events library
FROM maven:3.9.6-eclipse-temurin-17 AS shared-events-build
WORKDIR /shared-events
COPY shared-events_5/pom.xml .
COPY shared-events_5/src ./src
RUN mvn clean install -DskipTests -q

# Stage 2: Build incident-service
FROM shared-events-build AS build
WORKDIR /app
COPY incident-service_3/pom.xml .
RUN mvn dependency:go-offline -q
COPY incident-service_3/src ./src
RUN mvn clean package -DskipTests -q

# Stage 3: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8087
ENTRYPOINT ["java", "-jar", "app.jar"]
