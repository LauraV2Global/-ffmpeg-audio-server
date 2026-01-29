const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const UPLOAD_DIR = '/tmp/uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/process', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No video file provided' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join('/tmp', `output-${uuidv4()}.mp4`);

  // FILTRO COMBINADO: fase invertida + pitch shift + tremolo sutil
  const audioFilter = 'pan=stereo|c0=c0|c1=-1*c0,asetrate=44100*1.02,aresample=44100,tremolo=f=0.5:d=0.05';

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters(audioFilter)
        .outputOptions('-c:v', 'copy')
        .output(outputPath)
        .on('start', (cmd) => console.log('FFmpeg command:', cmd))
        .on('end', () => {
          console.log('FFmpeg OK. Filtro aplicado:', audioFilter);
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg ERROR:', err);
          reject(err);
        })
        .run();
    });

    const processedVideo = fs.readFileSync(outputPath);
    const base64Video = processedVideo.toString('base64');

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    return res.json({
      success: true,
      processedVideoBase64: base64Video,
      filterApplied: audioFilter,
    });

  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    return res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FFmpeg server running on port ${PORT}`));
