# Compila primero: mvn -f backend/pom.xml verify
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --chmod=0444 target/backend-0.0.1-SNAPSHOT.jar /app/app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
