package com.fleettrack.media.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@Slf4j
public class MinioConfig {

    @Value("${minio.endpoint:http://minio:9000}")
    private String endpoint;

    @Value("${minio.accessKey:fleettrack}")
    private String accessKey;

    @Value("${minio.secretKey:fleettrack123}")
    private String secretKey;

    @Value("${minio.bucket:fleettrack-media}")
    private String bucketName;

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }

    @Bean
    public ApplicationRunner ensureBucketExists(MinioClient minioClient) {
        return args -> {
            try {
                if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())) {
                    minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
                    log.info("Created MinIO bucket: {}", bucketName);
                } else {
                    log.info("MinIO bucket already exists: {}", bucketName);
                }
            } catch (Exception e) {
                log.error("Failed to ensure MinIO bucket exists: {}", bucketName, e);
            }
        };
    }
}
