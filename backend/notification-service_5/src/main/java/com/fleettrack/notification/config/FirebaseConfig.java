package com.fleettrack.notification.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;

/**
 * Initialises the Firebase Admin SDK from a service-account JSON on the classpath
 * (src/main/resources/firebase-service-account.json).
 *
 * IMPORTANT: this is GUARDED — if the file is missing or is still the placeholder, the
 * service boots normally and push is simply disabled (FcmService no-ops). Drop a real
 * service-account key in that file to enable push. Never commit a real key.
 */
@Component
@Slf4j
public class FirebaseConfig {

    @PostConstruct
    public void init() {
        try {
            if (!FirebaseApp.getApps().isEmpty()) return; // already initialised

            ClassPathResource resource = new ClassPathResource("firebase-service-account.json");
            if (!resource.exists()) {
                log.warn("firebase-service-account.json not found — push notifications DISABLED.");
                return;
            }
            try (InputStream is = resource.getInputStream()) {
                byte[] bytes = is.readAllBytes();
                String content = new String(bytes);
                // Guard against the empty placeholder file
                if (content.isBlank() || !content.contains("private_key")) {
                    log.warn("firebase-service-account.json is a placeholder — push notifications DISABLED.");
                    return;
                }
                GoogleCredentials credentials = GoogleCredentials.fromStream(new java.io.ByteArrayInputStream(bytes));
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(credentials)
                        .build();
                FirebaseApp.initializeApp(options);
                log.info("Firebase Admin initialised — push notifications ENABLED.");
            }
        } catch (Exception e) {
            log.warn("Failed to initialise Firebase Admin — push notifications DISABLED: {}", e.getMessage());
        }
    }
}
