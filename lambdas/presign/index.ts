import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({});
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const UPLOADS_BUCKET_NAME = process.env.UPLOADS_BUCKET_NAME!;
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  try {
    // 1. API Gateway Cognito Authorizer üzerinden gelen kullanıcı kimliği
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const userId = claims?.sub || claims?.username || 'anonymous-user';
    const userEmail = claims?.email || 'unknown';

    // 2. İstek gövdesinden (body) dosya türünü al
    const body = event.body ? JSON.parse(event.body) : {};
    const contentType = body.contentType || 'image/jpeg';
    const fileName = body.fileName || 'photo.jpg';

    const photoId = randomUUID();
    const objectKey = `raw/${userId}/${photoId}-${fileName}`;

    // 3. S3 Presigned PUT URL'i oluştur (5 dakika = 300 saniye geçerli)
    const putCommand = new PutObjectCommand({
      Bucket: UPLOADS_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 300 });

    // 4. DynamoDB'ye fotoğraf meta verisini kaydet
    const now = new Date().toISOString();
    await ddbClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          userId: userId,
          photoId: photoId,
          userEmail: userEmail,
          objectKey: objectKey,
          status: 'PENDING_UPLOAD',
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        uploadUrl,
        photoId,
        objectKey,
        expiresInSeconds: 300,
      }),
    };
  } catch (error: any) {
    console.error('Presign error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Presigned URL oluşturulamadı', error: error.message }),
    };
  }
};
