'use server';

import { generateR2PresignedUrl } from '@/lib/storage/r2';

export async function getUploadUrl(fileName: string, contentType: string) {
  try {
    const data = await generateR2PresignedUrl(fileName, contentType);
    return { success: true, data };
  } catch (error: any) {
    console.error('Failed to generate presigned URL', error);
    return { success: false, error: error.message || 'Failed to generate upload URL' };
  }
}
