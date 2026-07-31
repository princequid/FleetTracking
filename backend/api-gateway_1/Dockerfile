FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q -Dmaven.wagon.http.retryHandler.count=5 -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 -Dmaven.wagon.rto=60000
COPY src ./src
RUN mvn clean package -DskipTests -q -Dmaven.wagon.http.retryHandler.count=5 -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 -Dmaven.wagon.rto=60000

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
# Run as an unprivileged user. eclipse-temurin defaults to UID 0, so an RCE in
# a Spring service otherwise yields root inside the container. Also required by
# the Kubernetes "restricted" PodSecurityStandard (runAsNonRoot).
RUN addgroup -S spring && adduser -S spring -G spring && chown -R spring:spring /app
USER spring:spring

ENTRYPOINT ["java", "-jar", "app.jar"]
