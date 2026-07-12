package com.fleettrack.auth.service;

import com.fleettrack.auth.model.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Set;
import java.util.UUID;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.access-token-expiry-minutes:60}")
    private int accessTokenExpiryMinutes;

    // Issuer/audience bind the token to THIS system, so a signed token minted for a
    // different service (even with the same secret) is rejected here, and vice-versa.
    @Value("${jwt.issuer:fleettrack-auth}")
    private String issuer;

    @Value("${jwt.audience:fleettrack-clients}")
    private String audience;

    public String generateAccessToken(User user) {
        return Jwts.builder()
                .subject(user.getEmail())
                .issuer(issuer)
                .audience().add(audience).and()
                .claim("userId", user.getId())
                .claim("role", user.getRole().name())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + (long) accessTokenExpiryMinutes * 60 * 1000))
                .signWith(getSigningKey(), Jwts.SIG.HS256)
                .compact();
    }

    public String generateRefreshToken() {
        return UUID.randomUUID().toString();
    }

    public boolean validateToken(String token) {
        try {
            getClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String extractEmail(String token) {
        return getClaims(token).getSubject();
    }

    public Long extractUserId(String token) {
        return ((Number) getClaims(token).get("userId")).longValue();
    }

    public String extractRole(String token) {
        return (String) getClaims(token).get("role");
    }

    // Verifies signature + expiry (via parseSignedClaims) AND enforces the expected
    // issuer and audience. Any mismatch throws, so callers treat the token as invalid.
    private Claims getClaims(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .requireIssuer(issuer)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Set<String> aud = claims.getAudience();
        if (aud == null || !aud.contains(audience)) {
            throw new JwtException("Invalid token audience");
        }
        return claims;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}
