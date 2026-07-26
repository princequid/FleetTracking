package com.fleettrack.media.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;

/**
 * Server-side validation of an uploaded photo before it is registered/persisted.
 * The client-supplied mimeType/fileSizeBytes on PhotoRegistrationRequest can't be
 * trusted on their own, so this re-checks against the actual object in MinIO:
 * 1) declared size against a hard cap, 2) declared MIME type against MinIO's
 * actual stored content-type, 3) a magic-byte sniff of the first few bytes
 * against known image signatures.
 */
@Service
public class PhotoValidationService {

    public static final long MAX_PHOTO_SIZE_BYTES = 10L * 1024 * 1024; // 10MB

    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG_MAGIC = {(byte) 0x89, 0x50, 0x4E, 0x47};

    public void validateSize(Long fileSizeBytes) {
        if (fileSizeBytes == null || fileSizeBytes <= 0 || fileSizeBytes > MAX_PHOTO_SIZE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Photo size must be between 1 byte and " + (MAX_PHOTO_SIZE_BYTES / (1024 * 1024)) + "MB");
        }
    }

    public void validateMimeType(String declaredMimeType, String actualContentType) {
        if (declaredMimeType == null || actualContentType == null
                || !declaredMimeType.equalsIgnoreCase(actualContentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Declared MIME type does not match the uploaded file's stored content type");
        }
    }

    // Reads (at most) the first 4 bytes off the given stream and checks them against
    // known image magic numbers. Caller is expected to mark()/reset() beforehand if
    // the remainder of the stream is still needed (e.g. for hashing).
    public void validateMagicBytes(InputStream inputStream) throws IOException {
        byte[] header = new byte[4];
        int read = inputStream.read(header);
        if (read < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is too small to be a valid photo");
        }

        boolean isJpeg = startsWith(header, JPEG_MAGIC);
        boolean isPng = read == 4 && startsWith(header, PNG_MAGIC);
        if (!isJpeg && !isPng) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "File does not match a supported image format (JPEG/PNG)");
        }
    }

    private boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
