
# Transcription Service - README
You can read more about this service in this [article](https://poly4.hashnode.dev/building-a-subtitle-service-for-your-app-using-aws-transcribe)

## Overview
The **Transcription Service** enables transcription of video files stored in an S3 bucket, generates subtitles in VTT format, and stores them back into S3. This service uses AWS Transcribe to process the video files and generate the transcriptions. If the video file is not located in the same region as the transcription bucket, the service will automatically copy the video to the correct region before processing.

This is a reusable service designed to be integrated into multiple projects for seamless transcription and subtitle generation.

---

## Features
- Transcribes video files stored in an S3 bucket using AWS Transcribe.
- Converts transcription data into **VTT (WebVTT)** format.
- Handles copying of the video file if it resides in a different region from the transcription bucket.
- Uploads the generated VTT subtitle file to an S3 bucket.

---

## Installation

1. **Install dependencies**  
   You need the following packages to use the transcription service:
   
   ```bash
   npm install @aws-sdk/client-s3 @aws-sdk/client-transcribe axios aws-transcription-to-vtt uuid
   ```

2. **Set up AWS Credentials**  
   Make sure your AWS credentials are set up properly. You can configure them via the AWS CLI or environment variables:
   
   - Use `aws configure` to set credentials locally.
   - Alternatively, set the environment variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

---

## How to Use the Service

### 1. Import the Service
You can import the transcription service into any part of your application where you need to transcribe video files.

```javascript
import { transcribeAndGenerateSubtitle } from './transcriptionService.mjs';
```

### 2. Call the Transcription Function
To initiate the transcription and subtitle generation, call the `transcribeAndGenerateSubtitle` function. Pass the S3 URL of the video file to this function.

```javascript
const videoS3Url = 'https://my-bucket.s3.us-east-1.amazonaws.com/video-file.mp4';
const subtitleUrl = await transcribeAndGenerateSubtitle(videoS3Url);
console.log(`Subtitles are available at: ${subtitleUrl}`);
```

### Function Parameters

- **`videoS3Url`** *(string)*: The S3 URL of the video you want to transcribe. This URL should be publicly accessible (or use proper AWS credentials).

### Function Output

- **Returns** *(string)*: The URL of the generated VTT subtitle file, uploaded to the specified S3 bucket.

---

## Behavior

- **Region Handling**:  
  If the video file resides in a different AWS region than the transcription bucket, the service will automatically copy the video to the correct region before initiating the transcription job.

- **Transcription**:  
  The transcription is done via AWS Transcribe, and the generated file is a `.vtt` file containing the subtitles.

- **Video Format**:  
  The service currently supports `mp4` video format. Ensure that the video you are uploading is in this format for transcription to work properly.

- **Polling for Completion**:  
  The service will poll AWS Transcribe every 5 seconds until the transcription job is completed. If the transcription fails, an error message will be thrown with the failure reason.

- **Subtitles Format**:  
  The transcription is converted to **WebVTT** format using the `aws-transcription-to-vtt` package and then uploaded to the S3 bucket.

---

## Example Use Case

```javascript
import { transcribeAndGenerateSubtitle } from './transcriptionService.mjs';

async function handleVideoTranscription(videoS3Url) {
  try {
    const subtitleUrl = await transcribeAndGenerateSubtitle(videoS3Url);
    console.log(`Subtitles generated successfully! You can access them here: ${subtitleUrl}`);
  } catch (error) {
    console.error('Transcription failed:', error.message);
  }
}

const videoUrl = 'https://my-bucket.s3.us-east-1.amazonaws.com/video-file.mp4';
handleVideoTranscription(videoUrl);
```

---

## Error Handling

- If the transcription job fails, the service will throw an error with the failure reason.
- If the video file is from a different region, it will automatically handle copying the file before proceeding with transcription.

---

## Configuration

You can modify the region, S3 bucket names, and other configuration settings as needed:

```javascript
const REGION = "us-west-1"; // AWS Region for transcription
const S3_BUCKET = "transcription-subtitles-files"; // The S3 bucket where subtitles will be stored
```

Make sure that the S3 bucket exists in the correct region and that you have the required permissions to read from the video bucket and write to the subtitle bucket.

---

## IAM Permissions

Ensure that your IAM role has the following permissions:

1. **S3 Permissions**:
   - `s3:GetObject` on the source video bucket.
   - `s3:PutObject` and `s3:CopyObject` on the subtitle bucket.

2. **Transcribe Permissions**:
   - `transcribe:StartTranscriptionJob`
   - `transcribe:GetTranscriptionJob`

## Bucket Policy
To allow proper functionality for transcription, ensure that the S3 bucket where subtitles will be stored is publicly accessible for reading and allows transcribe.amazonaws.com to write subtitles. Here’s the bucket policy you should apply:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::transcription-subtitles-files/*"
        },
        {
            "Sid": "AllowTranscribePutObject",
            "Effect": "Allow",
            "Principal": {
                "Service": "transcribe.amazonaws.com"
            },
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::transcription-subtitles-files/*"
        }
    ]
}
```

---

## Notes

- This service relies on the AWS Transcribe service, which may incur costs based on the length of the video being transcribed. Please refer to the [AWS Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/) for more details.
- Be aware of S3 bucket region limitations. The video and subtitle bucket must be in the same region, or the video will be automatically moved as part of the transcription process.
- AWS Transcribe API calls are limited to a maximum of 4 hours or 2 GB of video per API call. Make sure to limit the video size accordingly before submitting it for transcription.
