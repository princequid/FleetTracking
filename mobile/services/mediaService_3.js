import api from './api_1';
import * as FileSystem from 'expo-file-system';

export const mediaService = {
  async presignUpload(tripId, photoType, mimeType) {
    try {
      const response = await api.post('/media/presign', {
        tripId,
        photoType,
        mimeType,
      });
      return response.data;
    } catch (error) {
      console.error('Presign upload failed:', error);
      throw error;
    }
  },

  async uploadToMinio(presignedUrl, fileUri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      const fileBytes = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: fileBytes,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Upload to MinIO failed:', error);
      throw error;
    }
  },

  async registerPhoto(tripId, photoKey, photoType, lat, lng, takenAt) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(photoKey);
      const fileSizeBytes = fileInfo.exists ? fileInfo.size : 0;

      const response = await api.post('/media/photos', {
        tripId,
        photoKey,
        photoType,
        mimeType: 'image/jpeg',
        fileSizeBytes,
        lat,
        lng,
        takenAt,
      });
      return response.data;
    } catch (error) {
      console.error('Register photo failed:', error);
      throw error;
    }
  },

  async fullUploadFlow(tripId, photoType, fileUri, location) {
    try {
      // Step 1: Get presigned URL
      const presignResponse = await this.presignUpload(tripId, photoType, 'image/jpeg');
      const { uploadUrl, photoKey } = presignResponse;

      // Step 2: Upload to MinIO
      await this.uploadToMinio(uploadUrl, fileUri);

      // Step 3: Register photo with backend
      const { latitude, longitude } = location || {};
      const takenAt = new Date().toISOString();
      await this.registerPhoto(
        tripId,
        photoKey,
        photoType,
        latitude,
        longitude,
        takenAt
      );

      return { success: true, photoKey };
    } catch (error) {
      console.error('Full upload flow failed:', error);
      
      // Save to FileSystem for retry
      try {
        const retryData = {
          tripId,
          photoType,
          fileUri,
          location,
          timestamp: new Date().toISOString(),
        };
        const retryFileUri = `${FileSystem.documentDirectory}retry_${Date.now()}.json`;
        await FileSystem.writeAsStringAsync(
          retryFileUri,
          JSON.stringify(retryData)
        );
        console.log('Saved failed upload for retry:', retryFileUri);
      } catch (saveError) {
        console.error('Failed to save retry data:', saveError);
      }

      throw error;
    }
  },

  async getRetryQueue() {
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
      const retryFiles = files.filter((file) => file.startsWith('retry_') && file.endsWith('.json'));
      
      const retryQueue = [];
      for (const file of retryFiles) {
        const fileUri = `${FileSystem.documentDirectory}${file}`;
        const content = await FileSystem.readAsStringAsync(fileUri);
        retryQueue.push(JSON.parse(content));
      }
      return retryQueue;
    } catch (error) {
      console.error('Failed to get retry queue:', error);
      return [];
    }
  },

  async clearRetryItem(fileUri) {
    try {
      await FileSystem.deleteAsync(fileUri);
    } catch (error) {
      console.error('Failed to clear retry item:', error);
    }
  },
};

export default mediaService;
