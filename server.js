const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const upload = multer({
  dest: '/tmp/uploads/',
  limits: { fileSize: 500 * 1024 * 1024 }
});

app.post('/process', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const inputPath = req.file.path;
  const outputPath = `/tmp/output-${uuidv4()}.mp4`;

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)                 // -i input.mp4
        .audioFilters(
          'pan=stereo|c0=c0|c1=-1*c0'   // -af "pan=stereo|c0=c0|c1=-1*c0"
        )
        .outputOptions(
          '-c:v', 'copy'                // -c:v copy
        )
        .output(outputPath)             // output.mp4
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const processedVideo = fs.readFileSync(outputPath);
    const base64Video = processedVideo.toString('base64');

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    res.json({
      success: true,
      processedVideoBase64: base64Video
    });

  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('FFmpeg server running on port 3000');
});
