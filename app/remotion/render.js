'use strict';

/**
 * ACE — local 9:16 video renderer.
 *
 * This is the "local pipeline" half of the export contract. It renders the
 * Content Editor's three tracks into a real H.264 MP4:
 *
 *   visual track  -> background colour, accent box, image asset
 *   text track    -> libass/ASS layers (Thai shaped by HarfBuzz)
 *   audio track   -> per-scene narration files (MP3/WAV) mixed into one AAC
 *                    track; scenes without a file stay silent
 *
 * No network call is made, no external account is touched and the encoder is
 * a local binary. Remotion remains an option for a future phase; this
 * renderer is deterministic and dependency-free apart from ffmpeg itself.
 *
 * ffmpeg discovery order:
 *   1. $ACE_FFMPEG          — explicit path
 *   2. $FFMPEG_PATH         — conventional override
 *   3. .tmp/tools/...      — repo-local install (git-ignored)
 *   4. `ffmpeg` on PATH
 */

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buildAss } = require('./ass');

const REPO_DIR = path.join(__dirname, '..', '..');
const CANVAS = { width: 1080, height: 1920, fps: 30 };

/* ------------------------------------------------------------------ */
/* Tool discovery                                                      */
/* ------------------------------------------------------------------ */

function localToolCandidates() {
  const base = path.join(REPO_DIR, '.tmp', 'tools', 'node_modules');
  if (process.platform === 'win32') {
    return [
      path.join(base, '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
      path.join(base, 'ffmpeg-static', 'ffmpeg.exe'),
    ];
  }
  return [
    path.join(base, '@ffmpeg-installer', 'linux-x64', 'ffmpeg'),
    path.join(base, '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
    path.join(base, 'ffmpeg-static', 'ffmpeg'),
  ];
}

function isExecutable(file) {
  try {
    if (!fs.existsSync(file)) return false;
    const stat = fs.statSync(file);
    if (!stat.isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveFfmpeg() {
  const explicit = process.env.ACE_FFMPEG || process.env.FFMPEG_PATH;
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (isExecutable(resolved)) return resolved;
    return null;
  }
  for (const candidate of localToolCandidates()) {
    if (isExecutable(candidate)) return candidate;
  }
  const onPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (onPath.status === 0) {
    const first = String(onPath.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
    if (first && isExecutable(first)) return first;
  }
  return null;
}

function ffmpegAvailable() {
  return resolveFfmpeg() !== null;
}

/* ------------------------------------------------------------------ */
/* Thai font discovery                                                 */
/* ------------------------------------------------------------------ */

// Windows ships Leelawadee UI (a genuine Thai UI face) on every Thai and
// international install; Tahoma and Cordia cover the older ones.
const FONT_CANDIDATES = [
  { file: 'C:/Windows/Fonts/leelawad.ttf', family: 'Leelawadee UI' },
  { file: 'C:/Windows/Fonts/leelawdb.ttf', family: 'Leelawadee UI' },
  { file: 'C:/Windows/Fonts/tahoma.ttf', family: 'Tahoma' },
  { file: 'C:/Windows/Fonts/tahomabd.ttf', family: 'Tahoma' },
  { file: 'C:/Windows/Fonts/cordia.ttc', family: 'Cordia' },
  { file: '/System/Library/Fonts/Thonburi.ttc', family: 'Thonburi' },
  { file: '/System/Library/Fonts/Supplemental/Thonburi.ttc', family: 'Thonburi' },
  { file: '/usr/share/fonts/truetype/tlwg/NotoSansThai-Regular.ttf', family: 'Noto Sans Thai' },
  { file: '/usr/share/fonts/truetype/tlwg/Garuda.ttf', family: 'Garuda' },
  { file: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', family: 'DejaVu Sans' },
];

function resolveFont() {
  const override = process.env.ACE_THAI_FONT;
  if (override && fs.existsSync(override)) {
    return { family: process.env.ACE_THAI_FONT_FAMILY || path.basename(override, path.extname(override)), file: path.resolve(override) };
  }
  for (const candidate of FONT_CANDIDATES) {
    if (fs.existsSync(candidate.file)) {
      return { family: candidate.family, file: candidate.file };
    }
  }
  return null;
}

function fontSearchDir(font) {
  if (!font) return null;
  const dir = path.dirname(font.file);
  if (!dir || !fs.existsSync(dir)) return null;
  return dir;
}

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

function toFfmpegColor(hex) {
  const clean = String(hex || '#000000').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  return `0x${full}`;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * Escapes a path so it survives ffmpeg's filter-option parser.
 *
 * Inside a filter graph `:` separates options and `\` starts an escape, so a
 * Windows drive letter ("Y:/...") would otherwise split the value in two.
 */
function escapeFilterValue(value) {
  return String(value).replace(/\\/g, '/').replace(/:/g, '\\:');
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/**
 * Builds the ffmpeg filter graph for the storyboard.
 *
 * Every scene becomes one segment: a flat colour source, an optional image
 * loop, the accent box that carries the visual track, then the ASS layer that
 * carries the text track. Segments are concatenated, which keeps every scene
 * independently editable while producing a single continuous file.
 */
function buildFilterGraph(scenes, assFile, fontDir) {
  const inputs = [];
  const chains = [];
  const audioSegments = [];
  let index = 0;

  for (const scene of scenes) {
    const duration = Math.max(0.5, Number(scene.duration_s) || 3);
    const visual = scene.visual || {};
    const background = visual.background || {};
    const base = toFfmpegColor(background.from || background.colour || '#12151C');
    const accent = toFfmpegColor(background.accent || '#2E7DF6');

    const imageRef = visual.asset_ref && visual.asset_file;
    if (imageRef && fs.existsSync(imageRef)) {
      inputs.push('-loop', '1', '-t', String(duration), '-i', imageRef);
      chains.push(
        `[${index}:v]scale=${CANVAS.width}:${CANVAS.height}:force_original_aspect_ratio=increase,` +
        `crop=${CANVAS.width}:${CANVAS.height},` +
        `drawbox=x=0:y=0:w=${CANVAS.width}:h=${CANVAS.height}:color=black@0.42:t=fill,` +
        `drawbox=x=0:y=0:w=14:h=${CANVAS.height}:color=${accent}@1:t=fill,` +
        `drawbox=x=0:y=${CANVAS.height - 300}:w=${CANVAS.width}:h=300:color=${accent}@0.92:t=fill` +
        `[sc${index}]`
      );
      index += 1;
    } else {
      inputs.push('-f', 'lavfi', '-t', String(duration), '-i', `color=c=${base}:s=${CANVAS.width}x${CANVAS.height}:r=${CANVAS.fps}`);
      chains.push(
        `[${index}:v]` +
        `drawbox=x=0:y=0:w=14:h=${CANVAS.height}:color=${accent}@1:t=fill,` +
        `drawbox=x=0:y=${CANVAS.height - 300}:w=${CANVAS.width}:h=300:color=${accent}@0.92:t=fill` +
        `[sc${index}]`
      );
      index += 1;
    }

    // A scene that carries a narration file contributes one extra audio
    // input; the audio graph addresses it by this index (see buildAudioGraph).
    const audioFile = scene.audio_asset_file && fs.existsSync(scene.audio_asset_file)
      ? scene.audio_asset_file
      : null;
    if (audioFile) {
      inputs.push('-i', audioFile);
      audioSegments.push({ duration, inputIndex: index });
      index += 1;
    } else {
      audioSegments.push({ duration, inputIndex: null });
    }
  }

  const assOptions = [`filename='${escapeFilterValue(assFile)}'`];
  if (fontDir) assOptions.push(`fontsdir='${escapeFilterValue(fontDir)}'`);
  const assFilter = `ass=${assOptions.join(':')}`;

  const segmentLabels = chains.map((_, i) => `[sc${i}]`).join('');
  chains.push(`${segmentLabels}concat=n=${chains.length}:v=1:a=0[vcat]`);
  chains.push(`[vcat]${assFilter}[vout]`);

  return { inputs, filter: chains.join(';'), audioSegments };
}

/**
 * Builds the per-scene audio graph.
 *
 * Three-phase 1.1 audio support: a scene may carry a real narration file.
 * When at least one scene has audio, every scene needs an audio segment so
 * the concat stays in sync with the video; scenes without a file stay silent.
 * A single anullsrc input is asplit into as many silent segments as needed,
 * so each scene contributes exactly one [aK] stream in storyboard order and
 * the final concat produces one continuous narration track.
 *
 * @param {Array}  audioSegments per scene: { duration, inputIndex|null }
 * @returns {{ inputs: string[], filter: string, concatLabel: string, hasAudio: boolean }}
 */
function remainingLength(audioSegments) {
  // The silent bed only feeds per-scene atrim copies, so its length just has
  // to cover the total; keeping it at the sum avoids an early EOF mid-concat.
  return audioSegments.reduce((sum, segment) => sum + Math.max(0.5, Number(segment.duration) || 3), 0);
}

function buildAudioGraph(audioSegments) {
  const inputs = [];
  const hasAudio = audioSegments.some((segment) => segment.inputIndex !== null);

  if (!hasAudio) {
    // No scene carries audio: the caller keeps the single silent bed.
    return { inputs, filter: null, hasAudio: false };
  }

  const bedInputIndex = inputs.length;
  inputs.push('-f', 'lavfi', '-t', String(remainingLength(audioSegments)), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');

  const chains = [];
  const silentScenes = audioSegments
    .map((segment, scene) => ({ segment, scene }))
    .filter((entry) => entry.segment.inputIndex === null);

  // One asplit call carves the shared silent bed into one stream per silent
  // scene; each copy is trimmed to that scene's duration in the loop below.
  if (silentScenes.length === 1) {
    chains.push(`[${bedInputIndex}:a]aformat=sample_fmts=fltp:channel_layouts=stereo[s0]`);
  } else if (silentScenes.length > 1) {
    const outputs = silentScenes.map((_, i) => `[s${i}]`).join('');
    chains.push(`[${bedInputIndex}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=n=${silentScenes.length}${outputs}`);
  }

  const segmentLabels = audioSegments.map((_, scene) => `[a${scene}]`);
  let silentNumber = 0;
  for (let scene = 0; scene < audioSegments.length; scene += 1) {
    const segment = audioSegments[scene];
    if (segment.inputIndex === null) {
      chains.push(`[s${silentNumber}]atrim=0:${segment.duration},asetpts=PTS-STARTPTS[a${scene}]`);
      silentNumber += 1;
    } else {
      chains.push(
        `[${segment.inputIndex}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
        `apad=whole_dur=${segment.duration},atrim=0:${segment.duration},asetpts=PTS-STARTPTS[a${scene}]`
      );
    }
  }

  chains.push(`${segmentLabels.join('')}concat=n=${segmentLabels.length}:v=0:a=1[acat]`);
  return { inputs, filter: chains.join(';'), hasAudio: true };
}

/**
 * Renders the project to an MP4.
 *
 * @param {object} options
 * @param {Array}  options.scenes    storyboard scenes (may carry audio_asset_file)
 * @param {string} options.outFile   destination .mp4 path
 * @param {string} options.workDir   scratch directory for the .ass file
 * @param {object} options.assets    { assetId: absolute file path } for image assets
 */
function renderVideo(options) {
  const scenes = Array.isArray(options.scenes) ? options.scenes : [];
  const outFile = path.resolve(options.outFile);
  const workDir = path.resolve(options.workDir);
  const assets = options.assets || {};

  if (!scenes.length) {
    const err = new Error('the storyboard has no scenes to render');
    err.status = 400;
    throw err;
  }

  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) {
    const err = new Error(
      'ffmpeg is not available, so no video can be rendered. Install it with ' +
      '"npm install --prefix .tmp/tools @ffmpeg-installer/ffmpeg" or set $ACE_FFMPEG to a binary.'
    );
    err.status = 503;
    throw err;
  }

  const font = resolveFont();
  if (!font) {
    const err = new Error('no Thai-capable font was found, so the text track cannot be rendered');
    err.status = 503;
    throw err;
  }

  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const resolvedScenes = scenes.map((scene) => {
    const visual = scene.visual || {};
    const assetFile = visual.asset_ref ? assets[visual.asset_ref] : null;
    return { ...scene, visual: { ...visual, asset_file: assetFile || null } };
  });

  const assFile = path.join(workDir, 'subtitle.ass');
  fs.writeFileSync(
    assFile,
    buildAss({
      scenes: resolvedScenes,
      width: CANVAS.width,
      height: CANVAS.height,
      fps: CANVAS.fps,
      fontFamily: font.family,
    }),
    'utf8'
  );

  const graph = buildFilterGraph(resolvedScenes, assFile, fontSearchDir(font));
  const audioGraph = buildAudioGraph(graph.audioSegments);

  const filterScript = path.join(workDir, 'filter.txt');
  fs.writeFileSync(filterScript, [graph.filter, audioGraph.filter].filter(Boolean).join(';'), 'utf8');

  const totalDuration = resolvedScenes.reduce((sum, scene) => sum + Math.max(0.5, Number(scene.duration_s) || 3), 0);

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    ...graph.inputs,
    ...audioGraph.inputs,
  ];
  if (audioGraph.hasAudio) {
    // Narration mix: one audio segment per scene, concatenated in order.
    args.push('-filter_complex_script', filterScript, '-map', '[vout]', '-map', '[acat]');
  } else {
    // No scene carries audio: a single silent bed after every scene input.
    const audioIndex = resolvedScenes.length;
    args.push(
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex_script', filterScript,
      '-map', '[vout]',
      '-map', `${audioIndex}:a`,
    );
  }
  args.push(
    '-t', String(totalDuration),
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-r', String(CANVAS.fps),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-movflags', '+faststart',
    outFile,
  );

  const result = spawnSync(ffmpeg, args, { encoding: 'utf8', cwd: workDir });
  if (result.error) {
    const err = new Error(`ffmpeg could not be started: ${result.error.message}`);
    err.status = 503;
    throw err;
  }
  if (result.status !== 0) {
    const err = new Error(`ffmpeg failed with exit code ${result.status}: ${String(result.stderr || '').trim().slice(0, 800)}`);
    err.status = 500;
    throw err;
  }
  if (!fs.existsSync(outFile)) {
    const err = new Error('ffmpeg reported success but no output file was written');
    err.status = 500;
    throw err;
  }

  const stat = fs.statSync(outFile);
  return {
    file: outFile,
    bytes: stat.size,
    sha256: hashFile(outFile),
    width: CANVAS.width,
    height: CANVAS.height,
    fps: CANVAS.fps,
    duration_s: Math.round(totalDuration * 100) / 100,
    font: font.family,
    encoder: path.basename(ffmpeg),
    ass_file: assFile,
  };
}

/**
 * Reads the real stream properties back out of the encoded file, so the
 * report states what was produced rather than what was requested.
 */
function probeVideo(file) {
  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) return null;
  const ffprobe = path.join(path.dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
  let result = null;
  if (fs.existsSync(ffprobe)) {
    result = spawnSync(ffprobe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate,codec_name',
      '-show_entries', 'format=duration,size,format_name',
      '-of', 'json',
      file,
    ], { encoding: 'utf8' });
  }
  if (!result || result.status !== 0) {
    result = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
    const text = String(result.stderr || '');
    const width = /Video:.*?, (\d{2,5})x(\d{2,5})/.exec(text);
    const duration = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(text);
    return {
      width: width ? Number(width[1]) : null,
      height: width ? Number(width[2]) : null,
      duration_s: duration
        ? Math.round((Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])) * 100) / 100
        : null,
      raw: text.split('\n').slice(0, 20).join('\n'),
    };
  }
  const parsed = JSON.parse(result.stdout || '{}');
  const stream = (parsed.streams || [])[0] || {};
  const format = parsed.format || {};
  const [num, den] = String(stream.r_frame_rate || '30/1').split('/');
  return {
    width: stream.width || null,
    height: stream.height || null,
    fps: den ? Math.round((Number(num) / Number(den)) * 100) / 100 : null,
    codec: stream.codec_name || null,
    duration_s: format.duration ? Math.round(Number(format.duration) * 100) / 100 : null,
    bytes: format.size ? Number(format.size) : null,
    container: format.format_name || null,
  };
}

/**
 * Reads the duration and codec of an uploaded audio file (MP3/WAV) directly
 * from the file, so the asset metadata records what was uploaded rather than
 * what was claimed. Uses the ffmpeg -i parse path; the file may be MP3, WAV
 * or anything else the local binary can read.
 */
function probeAudio(file) {
  const ffmpeg = resolveFfmpeg();
  if (!ffmpeg) return null;
  const result = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const text = String(result.stderr || '');
  const duration = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(text);
  const stream = /Stream.*?: Audio: (\w+)/.exec(text);
  return {
    duration_s: duration
      ? Math.round((Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])) * 100) / 100
      : null,
    codec: stream ? stream[1] : null,
  };
}

module.exports = {
  CANVAS,
  resolveFfmpeg,
  ffmpegAvailable,
  resolveFont,
  renderVideo,
  probeVideo,
  probeAudio,
  hashFile,
  toFfmpegColor,
};
