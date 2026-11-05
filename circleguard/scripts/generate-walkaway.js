const fs = require('fs');
const path = require('path');

const videoPath = path.join(__dirname, '..', 'assets', 'walkaway.mp4');
const outPath = path.join(__dirname, '..', 'src', 'constants', 'walkawayVideo.ts');

const b64 = fs.readFileSync(videoPath).toString('base64');
const content = `// Auto-generated offline base64 data URI for walkaway.mp4 animation
export const WALKAWAY_VIDEO_DATA_URI = "data:video/mp4;base64,${b64}";
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('Successfully generated walkawayVideo.ts, size:', content.length);
