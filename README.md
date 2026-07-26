# FleetTrack Pro

Fleet tracking platform with mobile app, admin portal, and microservices backend.

SPER ADMIN:

# FleetTrack Pro

A fleet tracking and cargo safety application built with React Native (driver app), React.js/Vite (admin portal), and Java Spring Boot microservices.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Team Roles](#team-roles)
- [PC Setup (Windows)](#pc-setup-windows)
- [Clone and Run the Project](#clone-and-run-the-project)
- [Running Your Service](#running-your-service)
- [Useful Commands](#useful-commands)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

FleetTrack Pro consists of:

- **Driver Mobile App** — React Native + Expo (drivers use this on their phones)
- **Admin Portal** — React.js + Vite (dispatchers and admins use this in a browser)
- **9 Backend Microservices** — Java Spring Boot (the brain of the system)
- **PostgreSQL** — the database (runs in Docker)
- **RabbitMQ** — messaging between services (runs in Docker)
- **Redis** — caching and real-time data (runs in Docker)
- **OSRM** — routing engine, replaces Google Maps (runs in Docker)

---

## Team Roles

| Member | Role                                | Technologies                        |
| ------ | ----------------------------------- | ----------------------------------- |
| M1     | Platform Foundation + Core Records  | Java, Spring Boot, PostgreSQL       |
| M2     | Trip & GPS Tracking                 | Java, Spring Boot, WebSocket, Redis |
| M3     | Cargo Safety & Media                | Java, Spring Boot, S3/MinIO         |
| M4     | Admin Portal                        | React.js, Vite, Leaflet             |
| M5     | DevOps, Notifications & Integration | Java, Spring Boot, RabbitMQ, CI/CD  |

---

## PC Setup (Windows)

Follow these steps **in order**. Every team member needs to do this before they can run the project.

---

### Step 1 — Java Development Kit (JDK) 17

Java is what runs all the Spring Boot backend services. We use version 17 (LTS).

1. Go to https://adoptium.net
2. Download **Temurin 17 LTS** (Windows x64 .msi installer)
3. Run the installer — accept all defaults
4. **Important**: during install, make sure **"Set JAVA_HOME variable"** and **"Add to PATH"** are both checked

**Verify it worked** — open a new PowerShell window and run:

```powershell
java -version
```

You should see something like:

```
openjdk version "17.0.x" ...
```

> **Why we need this**: Java 17 is the runtime for all 9 Spring Boot microservices. Without it, none of the backend services will run.

---

### Step 2 — Apache Maven

Maven is the build tool for Spring Boot — it downloads all the Java libraries the project needs and compiles the code.

1. Go to https://maven.apache.org/download.cgi
2. Download the **Binary zip archive** (e.g. `apache-maven-3.9.x-bin.zip`)
3. Extract it to `C:\Program Files\Apache\maven`
4. Add Maven to your PATH:
   - Search "Environment Variables" in Windows Start menu
   - Click "Environment Variables"
   - Under "System variables", find `Path` → click Edit
   - Click New → add `C:\Program Files\Apache\maven\bin`
   - Click OK on all windows

**Verify it worked:**

```powershell
mvn -version
```

You should see:

```
Apache Maven 3.9.x ...
```

**Set MAVEN_OPTS** (prevents SSL download errors on Windows — run this once):

```powershell
[System.Environment]::SetEnvironmentVariable("MAVEN_OPTS", "-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT", "User")
```

Then close and reopen PowerShell. Verify:

```powershell
echo $env:MAVEN_OPTS
```

Should print: `-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT`

> **Why we need this**: Maven downloads all the Java libraries (Spring Boot, JWT, Flyway, etc.) automatically so you don't have to. The MAVEN_OPTS setting tells Java to trust Windows' own SSL certificates when downloading from the internet.

---

### Step 3 — Docker Desktop

Docker runs PostgreSQL, RabbitMQ, Redis, MinIO, and OSRM in containers. This means you don't have to install any of those separately — Docker handles everything.

1. Go to https://www.docker.com/products/docker-desktop
2. Download **Docker Desktop for Windows**
3. Run the installer — accept all defaults
4. Restart your computer when prompted
5. After restart, open Docker Desktop from the Start menu
6. Wait for it to finish starting (the whale icon in the system tray should stop animating)

**Verify it worked:**

```powershell
docker --version
docker compose version
```

> **Why we need this**: all the infrastructure (database, message queue, routing engine) runs in Docker containers. One command starts everything — no manual configuration needed.

---

### Step 4 — Node.js (LTS)

Node.js is required for the admin portal (React/Vite) and the mobile app (React Native/Expo).

1. Go to https://nodejs.org
2. Download the **LTS** version (the left button — not "Current")
3. Run the installer — accept all defaults

**Verify it worked:**

```powershell
node --version
npm --version
```

> **Why we need this**: the admin portal and mobile app are built with JavaScript/React. Node.js is the runtime that powers those development tools.

---

### Step 5 — Git

Git is the version control system — how the whole team shares code through GitHub.

1. Go to https://git-scm.com/download/win
2. Download and run the installer
3. Accept all defaults (the defaults are fine for this project)

**Verify it worked:**

```powershell
git --version
```

**Set your identity** (use your own name and email — this appears on your commits):

```powershell
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"
```

> **Why we need this**: every code change you make gets tracked by Git. Your teammates can see what you changed, and you can pull their changes into your copy of the project.

---

### Step 6 — IntelliJ IDEA (Backend Members: M1, M2, M3, M5)

IntelliJ is the best IDE (code editor) for Java/Spring Boot development.

1. Go to https://www.jetbrains.com/idea/download
2. Download **Community Edition** (free — scroll down, it's below the paid version)
3. Run the installer — accept all defaults
4. On the "Installation Options" screen, check **"Add to PATH"** and **"Associate .java files"**

**Install these plugins inside IntelliJ** (File → Settings → Plugins → Marketplace):

- **Lombok** — required, without this you'll see red errors everywhere in the code
- **Spring Boot** — highlights Spring annotations and application.yml
- **Docker** — manage containers from inside IntelliJ

> **Why we need this**: IntelliJ understands Spring Boot deeply — it autocompletes annotations, highlights errors before you run, and makes navigating a large project much easier than a plain text editor.

---

### Step 7 — VS Code (Frontend Member: M4, and optional for others)

VS Code is the best editor for React.js and React Native development.

1. Go to https://code.visualstudio.com
2. Download and run the installer
3. Accept all defaults — make sure **"Add to PATH"** is checked

**Install these extensions inside VS Code** (click the Extensions icon on the left sidebar):

- **ES7+ React/Redux/React-Native snippets** — shortcuts for writing React code faster
- **Prettier** — automatically formats your code
- **ESLint** — catches JavaScript errors as you type
- **Tailwind CSS IntelliSense** — autocomplete for Tailwind classes
- **YAML** — syntax highlighting for application.yml files

> **Why we need this**: VS Code is lightweight and has excellent JavaScript/React support through its extensions.

---

### Step 8 — Postman

Postman is used to test API endpoints — send requests and see responses without needing the frontend built yet.

1. Go to https://www.postman.com/downloads
2. Download and install — no special configuration needed

> **Why we need this**: during development, you'll need to test your endpoints before the mobile app or admin portal can call them. Postman lets you do this manually.

---

### Step 9 — DBeaver (Recommended for all backend members)

DBeaver is a free database GUI — lets you visually browse the PostgreSQL schemas and tables instead of typing SQL commands every time.

1. Go to https://dbeaver.io/download
2. Download **Community Edition** and install

**Connect to local database after Docker is running:**

- Host: `localhost`
- Port: `5432`
- Database: `fleettrack`
- Username: `fleettrack`
- Password: `fleettrack`

> **Why we need this**: you'll want to see your tables and data visually as you develop. Much faster than running `psql` commands every time.

---

### Step 10 — Expo Go (Mobile — install on your phone)

For testing the React Native driver app on a real device.

- **Android**: Search **"Expo Go"** on Google Play Store
- **iPhone**: Search **"Expo Go"** on App Store

> **Why we need this**: React Native apps run on your phone during development. Expo Go is the app that hosts them — scan a QR code and your phone runs the app instantly.

---

## Role-Specific Requirements Summary

| Member | JDK 17 | Maven | Docker | Node.js | Git | IntelliJ | VS Code | Postman | DBeaver | Expo Go |
| ------ | ------ | ----- | ------ | ------- | --- | -------- | ------- | ------- | ------- | ------- |
| M1     | ✅     | ✅    | ✅     | ❌      | ✅  | ✅       | ❌      | ✅      | ✅      | ❌      |
| M2     | ✅     | ✅    | ✅     | ❌      | ✅  | ✅       | ❌      | ✅      | ✅      | ❌      |
| M3     | ✅     | ✅    | ✅     | ✅      | ✅  | ✅       | ✅      | ✅      | ✅      | ✅      |
| M4     | ❌     | ❌    | ⚠️     | ✅      | ✅  | ❌       | ✅      | ✅      | ❌      | ❌      |
| M5     | ✅     | ✅    | ✅     | ✅      | ✅  | ✅       | ✅      | ✅      | ✅      | ❌      |

> ⚠️ M4 should install Docker Desktop so they can run the full stack locally when testing against real APIs.

---

## Clone and Run the Project

Once all tools are installed, follow these steps to get the project running on your machine.

### 1. Clone the repository

```powershell
git clone https://github.com/your-org/fleettrack-pro.git
cd fleettrack-pro
```

### 2. Start Docker services (database + OSRM)

```powershell
cd infrastructure_1
docker compose up -d postgres osrm
```

Verify they are running:

```powershell
docker ps
```

You should see `infrastructure_1-postgres-1` and `infrastructure_1-osrm-1` both showing `Up`.

### 3. Start Eureka Server (open a new terminal)

```powershell
cd backend\eureka-server
mvn spring-boot:run
```

Wait until you see `Started EurekaServerApplication`. Then open http://localhost:8761 — you should see the Eureka dashboard.

### 4. Start Auth Service (open a new terminal)

```powershell
cd backend\auth-service_1
mvn spring-boot:run
```

Wait until you see `Started AuthServiceApplication`. Check http://localhost:8761 — `AUTH-SERVICE` should appear.

### 5. Start API Gateway (open a new terminal)

```powershell
cd backend\api-gateway
mvn spring-boot:run
```

Wait until you see `Started ApiGatewayApplication`. Check http://localhost:8761 — `API-GATEWAY` should appear.

### 6. Verify everything is working

Open Postman and test:

```
POST http://localhost:8080/auth/login
Content-Type: application/json

{
  "email": "admin@fleettrack.com",
  "password": "Admin1234!"
}
```

You should get back an `accessToken` and `refreshToken`. If you do — the foundation is running correctly on your machine.

---

## Running Your Service

Once the foundation is running (steps 1-5 above), start your own service in a new terminal.

**M1 — vehicle-service:**

```powershell
cd backend\vehicle-service
mvn spring-boot:run
```

**M2 — trip-service:**

```powershell
cd backend\trip-service
mvn spring-boot:run
```

**M2 — gps-service:**

```powershell
cd backend\gps-service
mvn spring-boot:run
```

**M3 — media-service:**

```powershell
cd backend\media-service
mvn spring-boot:run
```

**M3 — incident-service:**

```powershell
cd backend\incident-service
mvn spring-boot:run
```

**M4 — admin portal:**

```powershell
cd admin-portal
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

**M5 — notification-service:**

```powershell
cd backend\notification-service
mvn spring-boot:run
```

---

## Useful Commands

### Docker

```powershell
# Start all Docker services
docker compose up -d

# Stop all Docker services
docker compose down

# Stop and wipe all data (fresh start)
docker compose down -v

# Check what's running
docker ps

# View logs for a specific service
docker compose logs postgres
docker compose logs osrm
```

### Maven

```powershell
# Run a Spring Boot service
mvn spring-boot:run

# Clean build and run (use this if you get strange errors)
mvn clean spring-boot:run

# Just compile without running
mvn compile

# Run tests
mvn test
```

### Git

```powershell
# Get latest changes from GitHub
git pull

# See what files you've changed
git status

# Stage your changes
git add .

# Commit your changes
git commit -m "your message here"

# Push to GitHub
git push

# Create a new branch for your feature
git checkout -b feature/your-feature-name
```

---

## Troubleshooting

### "java is not recognized as a command"

JDK was not added to PATH during installation. Reinstall JDK 17 from https://adoptium.net and make sure to check "Add to PATH" during setup.

### "mvn is not recognized as a command"

Maven was not added to PATH. Re-do Step 2 of the setup, making sure you add `C:\Program Files\Apache\maven\bin` to the System PATH.

### "PKIX path building failed" / SSL error when running Maven

Run this in PowerShell then close and reopen all terminals:

```powershell
[System.Environment]::SetEnvironmentVariable("MAVEN_OPTS", "-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT", "User")
```

### "password authentication failed for user fleettrack"

The Postgres container needs to be reset. Run:

```powershell
cd infrastructure_1
docker compose down -v
docker compose up -d postgres
```

Then reset the password:

```powershell
docker exec -it infrastructure_1-postgres-1 psql -U fleettrack -d fleettrack -c "ALTER USER fleettrack WITH PASSWORD 'fleettrack';"
```

### "no such service: postgres" when running docker compose

You are in the wrong folder. Make sure you are in `infrastructure_1/` before running docker compose commands.

### Service starts but doesn't appear in Eureka

Eureka takes about 30 seconds to register services after they start. Wait and refresh http://localhost:8761.

### Port already in use

Another process is using the port. Find and stop it:

```powershell
netstat -ano | findstr :8081
taskkill /PID <PID number from above> /F
```

---

## Service Port Reference

| Service              | Port  |
| -------------------- | ----- |
| API Gateway          | 8080  |
| Auth Service         | 8081  |
| Driver Service       | 8082  |
| Vehicle Service      | 8083  |
| Trip Service         | 8084  |
| GPS Service          | 8085  |
| Media Service        | 8086  |
| Incident Service     | 8087  |
| Notification Service | 8088  |
| Analytics Service    | 8089  |
| Audit Service        | 8090  |
| Eureka Server        | 8761  |
| PostgreSQL           | 5432  |
| OSRM Routing         | 5000  |
| RabbitMQ             | 5672  |
| RabbitMQ Dashboard   | 15672 |
| Redis                | 6379  |

---

## Questions?

Raise issues on GitHub or contact the project lead (M1) directly.
