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
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/process', upload.single('video'), async (req, res) => {
  const { volume, fadeIn, fadeOut, normalize, phaseInversion } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No video file' });
  }

  const inputPath = req.file.path;
  const outputPath = `/tmp/output-${uuidv4()}.mp4`;

  try {
    const audioFilters = [];

    if (volume && volume !== '1') {
      audioFilters.push(`volume=${volume}`);
    }
    if (fadeIn && parseFloat(fadeIn) > 0) {
      audioFilters.push(`afade=t=in:st=0:d=${fadeIn}`);
    }
    if (fadeOut && parseFloat(fadeOut) > 0) {
      audioFilters.push(`afade=t=out:st=0:d=${fadeOut}`);
    }
    if (normalize === 'true') {
      audioFilters.push('loudnorm');
    }
    if (phaseInversion === 'true') {
      audioFilters.push('pan=stereo|c0=c0|c1=-1*c0');
    }

    await new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath).outputOptions('-c:v', 'copy');
      
      if (audioFilters.length > 0) {
        cmd = cmd.audioFilters(audioFilters.join(','));
      }

      cmd.output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const video = fs.readFileSync(outputPath);
    const base64 = video.toString('base64');

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    res.json({ success: true, processedVideoBase64: base64 });
  } catch (error) {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
