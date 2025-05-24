import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import axios from "axios";
import vttConvert from "aws-transcription-to-vtt";
import { v4 as uuidv4 } from "uuid";

const REGION = "us-west-1"; // Change to your AWS Region
const S3_BUCKET = "transcription-subtitles-files"; // Bucket for storing VTT files and temporary videos
const S3_BASE_URL = `https://${S3_BUCKET}.s3.${REGION}.amazonaws.com`;

const transcribeClient = new TranscribeClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });

async function transcribeAndGenerateSubtitle(videoS3Url) {
  let mediaFileUri = videoS3Url;
  let copiedKey = null;

  // Check if the video S3 URL matches our region bucket
  const { hostname, pathname } = new URL(videoS3Url);
  const bucketRegion = hostname.split(".")[2]; // extract region part like "us-east-1"
  
  if (bucketRegion !== REGION) {
    console.log(`[i] Video is from different region (${bucketRegion}), copying to correct region...`);

    // Copy the object into our transcription bucket under transcribed-video/
    const sourceBucket = hostname.split(".")[0]; // get bucket name
    const sourceKey = decodeURIComponent(pathname.slice(1)); // remove leading "/"
    
    copiedKey = `transcribed-video/${uuidv4()}-${sourceKey.split("/").pop()}`; // Create unique path

    await s3Client.send(new CopyObjectCommand({
      CopySource: `/${sourceBucket}/${sourceKey}`,
      Bucket: S3_BUCKET,
      Key: copiedKey,
    }));

    console.log(`[+] Copied video for transcription: ${copiedKey}`);
    mediaFileUri = `${S3_BASE_URL}/${copiedKey}`;
  }

  const jobId = `transcription-job-${uuidv4()}`;

  const startParams = {
    TranscriptionJobName: jobId,
    LanguageCode: "en-US",
    MediaFormat: "mp4",
    Media: {
      MediaFileUri: mediaFileUri,
    },
    OutputBucketName: S3_BUCKET,
  };

  // Start transcription job
  await transcribeClient.send(new StartTranscriptionJobCommand(startParams));
  console.log(`[+] Started transcription job: ${jobId}`);

  // Polling transcription job status
  let completed = false;
  let transcriptFileUri = '';
  while (!completed) {
    await new Promise((r) => setTimeout(r, 5000)); // wait 5 seconds
    const { TranscriptionJob } = await transcribeClient.send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobId })
    );

    const status = TranscriptionJob.TranscriptionJobStatus;
    console.log(`[i] Job status: ${status}`);

    if (status === "COMPLETED") {
      completed = true;
      transcriptFileUri = TranscriptionJob.Transcript.TranscriptFileUri;
    } else if (status === "FAILED") {
      throw new Error(`Transcription job failed: ${TranscriptionJob.FailureReason}`);
    }
  }

  // Download transcription JSON
  const response = await axios.get(transcriptFileUri);
  const transcriptionJson = response.data;

  // Convert transcription to VTT
  const vttData = vttConvert(transcriptionJson);

  // Upload VTT file back to S3
  const vttKey = `subtitles/${jobId}.vtt`;

  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: vttKey,
    Body: vttData,
    ContentType: "text/vtt",
  }));

  const vttUrl = `${S3_BASE_URL}/${vttKey}`;
  console.log(`[+] Subtitle uploaded: ${vttUrl}`);

  // delete the copied video if we created one
  if (copiedKey) {
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: copiedKey,
      }));
      console.log(`[i] Cleaned up temporary copied video: ${copiedKey}`);
    } catch (cleanupError) {
      console.warn(`[!] Failed to delete temporary video (safe to ignore):`, cleanupError.message);
    }
  }

  return vttUrl;
}

export { transcribeAndGenerateSubtitle };
