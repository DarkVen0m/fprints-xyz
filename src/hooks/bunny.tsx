import { useBearStore } from '@/store';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';

/**
 * Configuration constants for image processing
 */
const CONFIG = {
  MAX_SIZE_MB: 10,
  MAX_DIMENSION: 1920,
  INITIAL_QUALITY: 0.8,
  AGGRESSIVE_QUALITY: 0.6,
  OUTPUT_FORMAT: 'image/webp',
} as const;

/**
 * Size bracket configuration for compression targets
 */
type SizeBracket = {
  readonly maxSize: number;
  readonly targetSize: number;
};

const SIZE_BRACKETS: readonly SizeBracket[] = [
  { maxSize: 1024 * 1024, targetSize: 250 * 1024 }, // < 1MB -> 250KB
  { maxSize: 5 * 1024 * 1024, targetSize: 1024 * 1024 }, // 1-5MB -> 1MB
  { maxSize: 10 * 1024 * 1024, targetSize: 2 * 1024 * 1024 }, // 5-10MB -> 2MB
  { maxSize: 20 * 1024 * 1024, targetSize: 3 * 1024 * 1024 }, // 10-20MB -> 3MB
  { maxSize: 50 * 1024 * 1024, targetSize: 5 * 1024 * 1024 }, // 20-50MB -> 5MB
];

/**
 * Type definitions for the upload response
 */
type UploadResponse = {
  url: string;
};

/**
 * Converts a file to base64 string
 */
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

/**
 * Custom hook for handling image uploads to Bunny CDN with automatic compression
 *
 * @returns {UseMutationResult} React Query mutation hook for handling uploads
 * @throws {Error} If authentication is missing or upload fails
 */
export const useBunnyUpload = (): UseMutationResult<
  UploadResponse,
  Error,
  File
> => {
  const session = useBearStore(state => state.session);

  /**
   * Compresses an image file according to size-based rules
   */
  const compressImage = async (file: File): Promise<File> => {
    const bracket =
      SIZE_BRACKETS.find(b => file.size <= b.maxSize) ??
      SIZE_BRACKETS[SIZE_BRACKETS.length - 1];

    const compressionOptions = {
      maxSizeMB: bracket.targetSize / (1024 * 1024),
      maxWidthOrHeight: CONFIG.MAX_DIMENSION,
      useWebWorker: true,
      fileType: CONFIG.OUTPUT_FORMAT,
      initialQuality: CONFIG.INITIAL_QUALITY,
    };

    try {
      let compressedFile = await imageCompression(file, compressionOptions);

      if (compressedFile.size > bracket.targetSize) {
        compressedFile = await imageCompression(file, {
          ...compressionOptions,
          initialQuality: CONFIG.AGGRESSIVE_QUALITY,
        });
      }
      return compressedFile;
    } catch (error) {
      console.warn('Image compression failed:', error);
      return file;
    }
  };

  /**
   * Uploads an image file to Bunny CDN
   */
  const uploadImage = async (file: File): Promise<UploadResponse> => {
    if (!session?.access_token) {
      throw new Error('No authentication token found');
    }

    const compressedFile = await compressImage(file);

    if (compressedFile.size > CONFIG.MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`File size must be less than ${CONFIG.MAX_SIZE_MB}MB`);
    }

    const base64Data = await fileToBase64(compressedFile);

    const response = await fetch(import.meta.env.VITE_BUNNY_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Data }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Failed to upload image' }));
      throw new Error(error.error || 'Failed to upload image');
    }

    return response.json();
  };

  return useMutation({
    mutationFn: uploadImage,
    onError: (error: Error) => {
      console.error('Upload error:', error.message);
    },
  });
};

export const usePostGetImage = (): UseMutationResult<File, Error, string> => {
  const session = useBearStore(state => state.session);

  return useMutation({
    mutationFn: async (url: string) => {
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(import.meta.env.VITE_GET_IMAGE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }

      const contentType = response.headers.get('Content-Type') || 'image/jpeg';
      const blob = await response.blob();

      // Create a File object with the correct content type
      const extension = contentType.split('/')[1] || 'jpg';
      return new File([blob], `image.${extension}`, { type: contentType });
    },
  });
};