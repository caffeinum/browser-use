import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage, Image } from 'canvas';
import type { CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from 'canvas';
import GIFEncoder from 'gif-encoder-2';
import { createLogger } from '../logging-config.js';
import { PLACEHOLDER_4PX_SCREENSHOT } from '../browser/views.js';
import type { AgentHistoryList } from './views.js';
import { is_new_tab_page } from '../utils.js';

// Type compatibility between node-canvas and browser canvas
type CompatibleCanvasContext =
  | NodeCanvasRenderingContext2D
  | CanvasRenderingContext2D;

const logger = createLogger('browser_use.agent.gif');

const chmodPrivateFile = (filePath: string) => {
  if (process.platform === 'win32') {
    return;
  }
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    /* best effort */
  }
};

const ensurePrivateDirectoryIfCreated = async (dirPath: string) => {
  const existed = fs.existsSync(dirPath);
  await fs.promises.mkdir(dirPath, { recursive: true, mode: 0o700 });
  if (!existed && process.platform !== 'win32') {
    try {
      await fs.promises.chmod(dirPath, 0o700);
    } catch {
      /* best effort */
    }
  }
};

export const decode_unicode_escapes_to_utf8 = (text: string) => {
  if (!text.includes('\\u')) {
    return text;
  }
  try {
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
};

const asDataUrl = (screenshot: string) => {
  if (!screenshot) {
    return '';
  }
  return screenshot.startsWith('data:')
    ? screenshot
    : `data:image/png;base64,${screenshot}`;
};

const loadScreenshot = async (screenshot: string) => {
  const normalized = asDataUrl(screenshot);
  return loadImage(normalized);
};

const FONT_CANDIDATES = [
  '"PingFang"',
  '"STHeiti Medium"',
  '"Microsoft YaHei"',
  '"SimHei"',
  '"SimSun"',
  '"Noto Sans CJK SC"',
  '"Arial"',
  '"Helvetica"',
  '"sans-serif"',
];

const pickFont = () => FONT_CANDIDATES.join(', ');

export const is_valid_gif_screenshot_candidate = (
  screenshot: string | null | undefined,
  pageUrl: string | null | undefined
) => {
  if (!screenshot || screenshot === PLACEHOLDER_4PX_SCREENSHOT) {
    return false;
  }
  return !is_new_tab_page(pageUrl ?? '');
};

const wrapText = (
  ctx: CompatibleCanvasContext,
  text: string,
  maxWidth: number
) => {
  const words = decode_unicode_escapes_to_utf8(text).split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
};

const drawRoundedRect = (
  ctx: CompatibleCanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string
) => {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const addOverlayToContext = (
  ctx: CompatibleCanvasContext,
  width: number,
  height: number,
  stepNumber: number,
  goalText: string,
  fontFamily: string,
  titleFontSize: number
) => {
  const margin = 40;
  const textColor = 'rgba(255,255,255,1)';
  const boxColor = 'rgba(0,0,0,0.7)';
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.font = `${titleFontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';

  const stepText = String(stepNumber);
  const stepMetrics = ctx.measureText(stepText);
  const stepWidth = stepMetrics.width;
  const stepHeight = titleFontSize;
  const stepX = margin;
  const stepY = height - stepHeight - margin - 10;
  drawRoundedRect(
    ctx,
    stepX - 20,
    stepY - 20,
    stepWidth + 40,
    stepHeight + 40,
    15,
    boxColor
  );
  ctx.fillText(stepText, stepX, stepY);

  const maxWidth = width - margin * 4;
  const lines = wrapText(ctx, goalText, maxWidth);
  const totalHeight = lines.length * (titleFontSize + 10);
  const goalX = (width - maxWidth) / 2;
  const goalY = stepY - totalHeight - 80;
  drawRoundedRect(
    ctx,
    goalX - 20,
    goalY - 20,
    maxWidth + 40,
    totalHeight + 40,
    15,
    boxColor
  );
  lines.forEach((line, idx) => {
    ctx.fillText(line, goalX, goalY + idx * (titleFontSize + 10));
  });
  ctx.restore();
};

const addLogo = (
  ctx: CompatibleCanvasContext,
  width: number,
  image: Image | null
) => {
  if (!image) return;
  ctx.save();
  const margin = 20;
  const targetHeight = 150;
  const aspect = image.width / image.height || 1;
  const targetWidth = targetHeight * aspect;
  ctx.globalAlpha = 0.9;
  // @ts-ignore - drawImage signature compatibility
  ctx.drawImage(
    image,
    width - targetWidth - margin,
    margin,
    targetWidth,
    targetHeight
  );
  ctx.restore();
};

const loadLogo = async () => {
  try {
    const logoPath = path.resolve('static/browser-use.png');
    await fs.promises.access(logoPath, fs.constants.F_OK);
    return await loadImage(logoPath);
  } catch {
    return null;
  }
};

const renderTaskFrame = (
  ctx: CompatibleCanvasContext,
  width: number,
  height: number,
  task: string,
  fontFamily: string,
  fontSize: number,
  lineSpacing: number,
  logo: Image | null
) => {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const maxWidth = width - 280;
  const lines = wrapText(ctx, task, maxWidth);
  const totalHeight = lines.length * fontSize * lineSpacing;
  let y = height / 2 - totalHeight / 2;
  lines.forEach((line) => {
    ctx.fillText(line, width / 2, y);
    y += fontSize * lineSpacing;
  });
  ctx.restore();
  addLogo(ctx, width, logo);
};

const drawScreenshotFrame = (
  ctx: CompatibleCanvasContext,
  width: number,
  height: number,
  image: Image,
  stepNumber: number,
  goalText: string,
  fontFamily: string,
  titleFontSize: number,
  logo: Image | null
) => {
  // @ts-ignore - drawImage signature compatibility
  ctx.drawImage(image, 0, 0, width, height);
  if (goalText) {
    addOverlayToContext(
      ctx,
      width,
      height,
      stepNumber,
      goalText,
      fontFamily,
      titleFontSize
    );
  }
  addLogo(ctx, width, logo);
};

export interface HistoryGifOptions {
  output_path?: string;
  duration?: number;
  show_goals?: boolean;
  show_task?: boolean;
  show_logo?: boolean;
  font_size?: number;
  title_font_size?: number;
  goal_font_size?: number;
  margin?: number;
  line_spacing?: number;
}

export const create_history_gif = async (
  task: string,
  history: AgentHistoryList,
  {
    output_path = 'agent_history.gif',
    duration = 3000,
    show_goals = true,
    show_task = true,
    show_logo = false,
    font_size = 40,
    title_font_size = 56,
    goal_font_size = 44,
    line_spacing = 1.5,
  }: HistoryGifOptions = {}
) => {
  if (!history.history.length) {
    logger.warn('No history to create GIF from');
    return;
  }

  const screenshots = history.screenshots();
  let firstRealScreenshot: string | null = null;
  for (let index = 0; index < screenshots.length; index += 1) {
    const screenshot = screenshots[index];
    const pageUrl = history.history[index]?.state?.url ?? null;
    if (is_valid_gif_screenshot_candidate(screenshot, pageUrl)) {
      firstRealScreenshot = screenshot as string;
      break;
    }
  }
  if (!firstRealScreenshot) {
    logger.warn(
      'No valid screenshots found (all are placeholders or from new tab pages)'
    );
    return;
  }

  const firstImage = await loadScreenshot(firstRealScreenshot);
  const width = firstImage.width;
  const height = firstImage.height;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const encoder = new GIFEncoder(width, height);

  const resolvedOutputPath = path.resolve(output_path);
  await ensurePrivateDirectoryIfCreated(path.dirname(resolvedOutputPath));
  const writeStream = fs.createWriteStream(resolvedOutputPath, {
    mode: 0o600,
  });
  encoder.createReadStream().pipe(writeStream);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(duration);
  encoder.setQuality(10);

  const fontFamily = pickFont();
  const logo = show_logo ? await loadLogo() : null;

  if (show_task && task) {
    ctx.clearRect(0, 0, width, height);
    // @ts-ignore - node-canvas types differ slightly from browser canvas
    renderTaskFrame(
      ctx,
      width,
      height,
      task,
      fontFamily,
      font_size + 16,
      line_spacing,
      logo
    );
    encoder.addFrame(ctx);
  }

  for (let index = 0; index < screenshots.length; index += 1) {
    const historyItem = history.history[index];
    if (is_new_tab_page(historyItem?.state?.url ?? '')) {
      logger.debug(
        `Skipping screenshot from new tab page (${historyItem?.state?.url ?? ''}) at step ${index}`
      );
      continue;
    }

    const screenshot = screenshots[index];
    if (!screenshot || screenshot === PLACEHOLDER_4PX_SCREENSHOT) {
      continue;
    }
    try {
      const image = await loadScreenshot(screenshot);
      ctx.clearRect(0, 0, width, height);
      const goalText =
        show_goals &&
        history.history[index]?.model_output?.current_state.next_goal
          ? history.history[index].model_output!.current_state.next_goal
          : '';
      // @ts-ignore - node-canvas types differ slightly from browser canvas
      drawScreenshotFrame(
        ctx,
        width,
        height,
        image,
        index + 1,
        goalText,
        fontFamily,
        goal_font_size,
        logo
      );
      encoder.addFrame(ctx);
    } catch (error) {
      logger.warn(
        `Failed to process screenshot at step ${index + 1}: ${(error as Error).message}`
      );
    }
  }

  encoder.finish();
  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
  chmodPrivateFile(resolvedOutputPath);
  logger.info(`Created GIF at ${output_path}`);
};
