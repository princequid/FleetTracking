package com.fleettrack.auth.email;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Sends transactional email over Gmail SMTP (via JavaMailSender). Best-effort: a
 * failed send is logged and swallowed, never thrown, so a flaky mail server can
 * never break the user-facing operation (registration, password reset, login) that
 * triggered it. Runs @Async so the caller doesn't wait on the network round trip.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${fleetsync.email.from-address:}")
    private String fromAddress;

    @Value("${fleetsync.email.from-name:FleetSync}")
    private String fromName;

    @Async
    public void sendEmail(String to, String subject, String htmlBody) {
        if (fromAddress == null || fromAddress.isBlank()) {
            log.warn("Skipping email to {} ({}) — GMAIL_USERNAME is not configured", to, subject);
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
            log.info("Sent email to {} ({})", to, subject);
        } catch (Exception e) {
            log.warn("Failed to send email to {} ({}): {}", to, subject, e.getMessage());
        }
    }
}
