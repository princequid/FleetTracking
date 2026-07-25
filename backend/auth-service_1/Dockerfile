# Stage 1: Build shared-events library
FROM maven:3.9-eclipse-temurin-17 AS shared-events-build
WORKDIR /shared-events
COPY shared-events_5/pom.xml .
COPY shared-events_5/src ./src
RUN mvn clean install -DskipTests -q

# Stage 2: Build auth-service (inherits shared-events from stage 1's .m2)
FROM shared-events-build AS build
WORKDIR /app
COPY auth-service_1/pom.xml .
RUN mvn dependency:go-offline
COPY auth-service_1/src ./src
RUN mvn package -DskipTests -q

# Stage 3: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/auth-service-*.jar app.jar
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
