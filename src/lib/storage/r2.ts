import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';

// Initialize S3 client configured for Cloudflare R2
const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function generateR2PresignedUrl(fileName: string, contentType: string) {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error('Cloudflare R2 is not fully configured in the environment.');
  }

  // Generate a unique path: [timestamp]-[filename]
  const path = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: path,
    ContentType: contentType,
  });

  const url = await getSignedUrl(S3, command, { expiresIn: 3600 }); // URL valid for 1 hour

  // Construct the public URL assuming R2 public bucket access is configured
  // Alternatively, if you have a custom domain mapped to the R2 bucket:
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;
  
  return {
    uploadUrl: url,
    publicUrl: `${publicDomain}/${path}`,
    path
  };
}
