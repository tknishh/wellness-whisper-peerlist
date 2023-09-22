import axios from "axios";
import { createWriteStream } from "fs";
import * as fs from 'fs';

const htApiUserId = process.env.PLAY_HT_USER_ID;
const htApiSecretKey = process.env.PLAY_HT_SECRET_KEY;
const htVoice = process.env.PLAY_HT_VOICE;

export async function textToSpeech(text: string) {
  if (!htApiUserId || !htApiSecretKey) {
    throw new Error("Play.ht API credentials not set.");
  }

  const endpoint = "https://play.ht/api/v1/convert";
  const headers = {
    Authorization: htApiSecretKey,
    "X-User-ID": htApiUserId,
    "Content-Type": "application/json",
  };
  const data = {
    voice: htVoice || "s3://peregrine-voices/russell2_parrot_saad/manifest.json",
    text: text,
    title: text.substring(0, 36),
  };

  const response = await axios.post(endpoint, data, { headers });
  // console.log("####audioResponse: ", response);

  const transcriptionId = response.data.transcriptionId;
  const transcriptionStatusUrl = `https://play.ht/api/v1/articleStatus?transcriptionId=${transcriptionId}`;

  async function downloadTranscript() {
    const status = await axios.get(transcriptionStatusUrl, { headers });
    if (status.data.transcriped) {
      return status.data.audioUrl;
    }
  }

  let audioUrl: string | undefined;
  while (audioUrl === undefined) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    audioUrl = await downloadTranscript();
  }

  const transcriptPath = `./tmp/ht-${transcriptionId}.mp3`;
  const writestream = createWriteStream(transcriptPath);
  const download = await axios({
    method: "GET",
    url: audioUrl,
    responseType: "stream",
  });

  await new Promise(async (resolve, reject) => {
    download.data.pipe(writestream);
    writestream.on("finish", resolve);
    writestream.on("error", reject);
  });

  return transcriptPath;
}

export async function deleteAudioFilesAfterSent(filePath: string){
  await fs.promises.unlink(filePath);
}