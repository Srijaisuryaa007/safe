/**
 * CircleGuard File Upload Security
 * 
 * Enforces production file upload security:
 * 1. File Size Validation: Rejects files exceeding MAX_AVATAR_SIZE_BYTES (5MB).
 * 2. Binary Magic Byte Sniffing: Validates raw file content header, rejecting renamed executables or scripts.
 * 3. Prohibited Content Detection: Blocks SVGs (XSS risk), HTML, PHP, shell scripts, and executable binaries.
 * 4. Deterministic Isolated Path Generation: Rejects directory traversal (../) and user-supplied names.
 */

declare const Buffer: any;

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export type AllowedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: AllowedImageMimeType;
  extension?: 'jpg' | 'png' | 'webp';
  sanitizedPath?: string;
}

export interface ValidateImageOptions {
  base64Content: string;
  fileSizeBytes?: number;
  userId: string;
}

/**
 * Checks binary buffer or base64 prefix against known magic byte signatures
 */
export function detectMagicBytes(base64: string): { mime: AllowedImageMimeType; ext: 'jpg' | 'png' | 'webp' } | null {
  if (!base64 || typeof base64 !== 'string') return null;

  // Clean data URI prefix if present (e.g. data:image/jpeg;base64,...)
  const cleanBase64 = base64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();
  if (cleanBase64.length < 4) return null;

  // Convert first 32 characters of base64 to binary byte array
  let binaryString: string;
  if (typeof atob === 'function') {
    try {
      binaryString = atob(cleanBase64.substring(0, 48));
    } catch {
      return null;
    }
  } else if (typeof Buffer !== 'undefined') {
    try {
      binaryString = Buffer.from(cleanBase64.substring(0, 48), 'base64').toString('binary');
    } catch {
      return null;
    }
  } else {
    // Fallback base64 prefix match
    if (cleanBase64.startsWith('/9j/')) return { mime: 'image/jpeg', ext: 'jpg' };
    if (cleanBase64.startsWith('iVBORw0KGgo')) return { mime: 'image/png', ext: 'png' };
    if (cleanBase64.startsWith('UklGR')) return { mime: 'image/webp', ext: 'webp' };
    return null;
  }

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 1. JPEG Magic Bytes: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // 2. PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // 3. WebP Magic Bytes: RIFF (52 49 46 46) .... WEBP (57 45 42 50)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
}

/**
 * Checks for dangerous executable/script signatures in content header
 */
export function hasExecutableOrScriptSignature(base64: string): boolean {
  if (!base64) return false;

  let headerSample = '';
  try {
    const cleanBase64 = base64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();
    if (typeof atob === 'function') {
      headerSample = atob(cleanBase64.substring(0, 256));
    } else if (typeof Buffer !== 'undefined') {
      headerSample = Buffer.from(cleanBase64.substring(0, 256), 'base64').toString('utf8');
    }
  } catch {
    return false;
  }

  const lower = headerSample.toLowerCase();

  // SVG / XML / HTML / Script tags (Stored XSS vector)
  if (
    lower.includes('<svg') ||
    lower.includes('<?xml') ||
    lower.includes('xmlns') ||
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('<script') ||
    lower.includes('<body') ||
    lower.includes('javascript:')
  ) {
    return true;
  }

  // Server-side scripts
  if (lower.includes('<?php') || lower.includes('#!/bin') || lower.includes('#!/usr')) {
    return true;
  }

  // DOS/PE Executable ('MZ') or Linux ELF ('\x7FELF')
  if (headerSample.startsWith('MZ') || headerSample.startsWith('\x7FELF')) {
    return true;
  }

  return false;
}

/**
 * Validates an image before upload: size, magic bytes, prohibited scripts, and builds safe path.
 */
export function validateImageUpload(options: ValidateImageOptions): FileValidationResult {
  const { base64Content, fileSizeBytes, userId } = options;

  // 1. User ID validation (UUID / safe identifier)
  if (!userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
    return { valid: false, error: 'Invalid user session for file storage.' };
  }

  // 2. File size validation
  const calculatedSize = fileSizeBytes || Math.round((base64Content.length * 3) / 4);
  if (calculatedSize > MAX_AVATAR_SIZE_BYTES) {
    const maxMb = (MAX_AVATAR_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `Image size exceeds the maximum allowed limit of ${maxMb}MB.` };
  }

  if (calculatedSize === 0) {
    return { valid: false, error: 'Cannot upload empty image file.' };
  }

  // 3. Prohibited script/executable inspection
  if (hasExecutableOrScriptSignature(base64Content)) {
    return { valid: false, error: 'File format rejected: SVG, script, and executable files are not allowed.' };
  }

  // 4. Magic byte inspection
  const detected = detectMagicBytes(base64Content);
  if (!detected) {
    return {
      valid: false,
      error: 'Invalid image format. Only authentic JPEG, PNG, and WebP images are supported.'
    };
  }

  // 5. Deterministic, safe storage path (strictly isolated per user UID, preventing traversal)
  const timestamp = Date.now();
  const sanitizedPath = `${userId}/${timestamp}.${detected.ext}`;

  return {
    valid: true,
    detectedMimeType: detected.mime,
    extension: detected.ext,
    sanitizedPath
  };
}
