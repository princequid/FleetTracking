package com.fleettrack.media.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.event.EventListener;

@Configuration
@Slf4j
public class MinioConfig {

    @Value("${minio.endpoint:http://minio:9000}")
    private String endpoint;

    @Value("${minio.accessKey:fleettrack}")
    private String accessKey;

    @Value("${minio.secretKey:fleettrack123}")
    private String secretKey;

    @Value("${minio.external-endpoint:#{null}}")
    private String externalEndpoint;

    @Value("${minio.bucket:fleettrack-media}")
    private String bucketName;

    @Bean
    @Primary
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }

    @Bean
    public MinioClient presignMinioClient() {
        String presignEndpoint = (externalEndpoint != null && !externalEndpoint.isBlank())
                ? externalEndpoint : endpoint;
        return MinioClient.builder()
                .endpoint(presignEndpoint)
                .credentials(accessKey, secretKey)
                .region("us-east-1")
                .build();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureBucketExists() {
        try {
            MinioClient client = minioClient();
            boolean exists = client.bucketExists(
                    BucketExistsArgs.builder().bucket(bucketName).build());
            if (!exists) {
                client.makeBucket(
                        MakeBucketArgs.builder().bucket(bucketName).build());
                log.info("Created MinIO bucket: {}", bucketName);
            } else {
                log.info("MinIO bucket already exists: {}", bucketName);
            }
        } catch (Exception e) {
            log.error("Failed to ensure MinIO bucket exists: {}", bucketName, e);
            throw new RuntimeException("Failed to initialize MinIO bucket", e);
        }
    }
}
