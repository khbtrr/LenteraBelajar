import path from 'node:path';

export const ALLOWED_FILE_EXTENSIONS = new Set([
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
  // Images
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  // Audio & Video
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.m4a',
  // Archives
  '.zip', '.rar', '.7z',
]);

export function isAllowedFileExtension(filenameOrExt: string): boolean {
  const ext = filenameOrExt.startsWith('.')
    ? filenameOrExt.toLowerCase()
    : path.extname(filenameOrExt).toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.has(ext);
}

/**
 * Validates buffer against expected file signatures (magic bytes).
 * Returns true if the file header matches known signatures for the given extension,
 * or false if it is a definite mismatch or contains executable/HTML signatures disguised as safe files.
 */
export function validateFileMagicBytes(buffer: Buffer, extension: string): { valid: boolean; detectedMime?: string; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File buffer kosong' };
  }

  const ext = extension.toLowerCase();

  // 1. Universal Blacklist: Detect executable / script magic bytes regardless of claimed extension
  // Windows PE: 'MZ' (0x4D, 0x5A)
  if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return { valid: false, error: 'File executable Windows (MZ) tidak diizinkan' };
  }
  // Linux ELF: 0x7F, 'E', 'L', 'F' (0x7F 0x45 0x4C 0x46)
  if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return { valid: false, error: 'File executable Linux (ELF) tidak diizinkan' };
  }
  // Shebang script: '#!' (0x23, 0x21)
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21 && ext !== '.txt' && ext !== '.csv') {
    return { valid: false, error: 'Script dengan shebang tidak diizinkan' };
  }

  // 2. Format-specific signature verification
  // PDF: '%PDF-' (0x25 0x50 0x44 0x46)
  if (ext === '.pdf') {
    if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { valid: true, detectedMime: 'application/pdf' };
    }
    return { valid: false, error: 'Header file bukan format PDF yang valid' };
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (ext === '.png') {
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
      return { valid: true, detectedMime: 'image/png' };
    }
    return { valid: false, error: 'Header file bukan format PNG yang valid' };
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (ext === '.jpg' || ext === '.jpeg') {
    if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { valid: true, detectedMime: 'image/jpeg' };
    }
    return { valid: false, error: 'Header file bukan format JPEG yang valid' };
  }

  // GIF: 'GIF87a' or 'GIF89a' (0x47 0x49 0x46 0x38 [0x37|0x39] 0x61)
  if (ext === '.gif') {
    if (buffer.length >= 6 &&
        buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
      return { valid: true, detectedMime: 'image/gif' };
    }
    return { valid: false, error: 'Header file bukan format GIF yang valid' };
  }

  // WEBP: 'RIFF'....'WEBP'
  if (ext === '.webp') {
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return { valid: true, detectedMime: 'image/webp' };
    }
    return { valid: false, error: 'Header file bukan format WEBP yang valid' };
  }

  // ZIP / Modern Office (.docx, .xlsx, .pptx): 'PK\x03\x04' or 'PK\x05\x06' or 'PK\x07\x08'
  if (['.zip', '.docx', '.xlsx', '.pptx'].includes(ext)) {
    if (buffer.length >= 4 &&
        buffer[0] === 0x50 && buffer[1] === 0x4B &&
        ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
         (buffer[2] === 0x05 && buffer[3] === 0x06) ||
         (buffer[2] === 0x07 && buffer[3] === 0x08))) {
      const mimeMap: Record<string, string> = {
        '.zip': 'application/zip',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      };
      return { valid: true, detectedMime: mimeMap[ext] };
    }
    return { valid: false, error: `Header file bukan format archive/office XML (${ext}) yang valid` };
  }

  // Legacy Microsoft Office (.doc, .xls, .ppt): OLE compound file 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
  if (['.doc', '.xls', '.ppt'].includes(ext)) {
    if (buffer.length >= 8 &&
        buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
        buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1) {
      const mimeMap: Record<string, string> = {
        '.doc': 'application/msword',
        '.xls': 'application/vnd.ms-excel',
        '.ppt': 'application/vnd.ms-powerpoint',
      };
      return { valid: true, detectedMime: mimeMap[ext] };
    }
    return { valid: false, error: `Header file bukan format legacy Office (${ext}) yang valid` };
  }

  // RAR: 'Rar!\x1A\x07\x00' or 'Rar!\x1A\x07\x01\x00' (0x52 0x61 0x72 0x21 0x1A 0x07)
  if (ext === '.rar') {
    if (buffer.length >= 6 &&
        buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21 &&
        buffer[4] === 0x1A && buffer[5] === 0x07) {
      return { valid: true, detectedMime: 'application/x-rar-compressed' };
    }
    return { valid: false, error: 'Header file bukan format RAR yang valid' };
  }

  // 7z: '7z\xBC\xAF\x27\x1C' (0x37 0x7A 0xBC 0xAF 0x27 0x1C)
  if (ext === '.7z') {
    if (buffer.length >= 6 &&
        buffer[0] === 0x37 && buffer[1] === 0x7A && buffer[2] === 0xBC &&
        buffer[3] === 0xAF && buffer[4] === 0x27 && buffer[5] === 0x1C) {
      return { valid: true, detectedMime: 'application/x-7z-compressed' };
    }
    return { valid: false, error: 'Header file bukan format 7-Zip yang valid' };
  }

  // OGG: 'OggS' (0x4F 0x67 0x67 0x53)
  if (ext === '.ogg') {
    if (buffer.length >= 4 &&
        buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
      return { valid: true, detectedMime: 'audio/ogg' };
    }
    return { valid: false, error: 'Header file bukan format OGG yang valid' };
  }

  // WAV: 'RIFF'....'WAVE'
  if (ext === '.wav') {
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
      return { valid: true, detectedMime: 'audio/wav' };
    }
    return { valid: false, error: 'Header file bukan format WAV yang valid' };
  }

  // MP3: ID3 tag ('ID3') or sync word 0xFF 0xFB / 0xFF 0xF3 / 0xFF 0xF2
  if (ext === '.mp3') {
    const hasId3 = buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
    const hasSync = buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0;
    if (hasId3 || hasSync) {
      return { valid: true, detectedMime: 'audio/mpeg' };
    }
    return { valid: false, error: 'Header file bukan format MP3 yang valid' };
  }

  // MP4 / M4A: ftyp box at offset 4: 'ftyp'
  if (ext === '.mp4' || ext === '.m4a') {
    if (buffer.length >= 8 &&
        buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      return { valid: true, detectedMime: ext === '.m4a' ? 'audio/mp4' : 'video/mp4' };
    }
    return { valid: false, error: 'Header file bukan format MP4/M4A yang valid' };
  }

  // WebM: Matroska / EBML header 0x1A 0x45 0xDF 0xA3
  if (ext === '.webm') {
    if (buffer.length >= 4 &&
        buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
      return { valid: true, detectedMime: 'video/webm' };
    }
    return { valid: false, error: 'Header file bukan format WebM yang valid' };
  }

  // Text / CSV: Check that the file doesn't start with binary garbage or HTML / script tags
  if (ext === '.txt' || ext === '.csv') {
    const headerSnippet = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf-8').trim().toLowerCase();
    if (headerSnippet.startsWith('<!doctype html') || headerSnippet.startsWith('<html') || headerSnippet.startsWith('<script') || headerSnippet.startsWith('<?php')) {
      return { valid: false, error: 'File teks berisi kode HTML/Script/PHP yang tidak diizinkan' };
    }
    return { valid: true, detectedMime: ext === '.csv' ? 'text/csv' : 'text/plain' };
  }

  return { valid: true };
}
