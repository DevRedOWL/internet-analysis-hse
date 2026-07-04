import { loadImage } from 'canvas';
import emojiRegex from 'emoji-regex';
import twemoji from 'twemoji';

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';
const emojiImageCache = new Map();

export function splitTextSegments(text) {
  const re = emojiRegex();
  const segments = [];
  let lastIndex = 0;

  for (const match of String(text ?? '').matchAll(re)) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'emoji', value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: 'text', value: String(text ?? '') }];
}

async function loadEmojiImage(emoji) {
  const codePoint = twemoji.convert.toCodePoint(emoji);
  if (emojiImageCache.has(codePoint)) {
    return emojiImageCache.get(codePoint);
  }

  const image = await loadImage(`${TWEMOJI_BASE}/${codePoint}.png`);
  emojiImageCache.set(codePoint, image);
  return image;
}

export async function measureTextWithEmojis(ctx, text, fontSize = 16) {
  const segments = splitTextSegments(text);
  let width = 0;

  for (const segment of segments) {
    if (segment.type === 'text') {
      width += ctx.measureText(segment.value).width;
    } else {
      width += fontSize;
    }
  }

  return width;
}

export async function drawTextWithEmojis(ctx, text, x, y, options = {}) {
  const fontSize = options.fontSize ?? 16;
  const maxWidth = options.maxWidth;
  const align = options.align ?? 'left';
  const segments = splitTextSegments(text);
  let totalWidth = 0;

  for (const segment of segments) {
    if (segment.type === 'text') {
      totalWidth += ctx.measureText(segment.value).width;
    } else {
      totalWidth += fontSize;
    }
  }

  let cursorX = x;
  if (align === 'center' && maxWidth != null) {
    cursorX = x + Math.max(0, (maxWidth - totalWidth) / 2);
  } else if (align === 'right' && maxWidth != null) {
    cursorX = x + Math.max(0, maxWidth - totalWidth);
  }

  for (const segment of segments) {
    if (segment.type === 'text') {
      if (segment.value) {
        ctx.fillText(segment.value, cursorX, y);
        cursorX += ctx.measureText(segment.value).width;
      }
      continue;
    }

    const image = await loadEmojiImage(segment.value);
    ctx.drawImage(image, cursorX, y - fontSize + 3, fontSize, fontSize);
    cursorX += fontSize;
  }

  return totalWidth;
}
