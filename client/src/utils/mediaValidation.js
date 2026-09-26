export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/wav', 'audio/x-m4a'];

export const MAX_IMAGE_MB = 10;
export const MAX_VIDEO_MB = 50;
export const MAX_AUDIO_MB = 10;

export function validateMediaFile(file) {
  if (!file) return 'No file selected.';
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  const isAudio = AUDIO_TYPES.includes(file.type.split(';')[0]);
  if (!isImage && !isVideo && !isAudio) {
    return 'Unsupported file. Photos: JPG, PNG, WEBP. Videos: MP4, MOV, WEBM.';
  }
  const limitMb = isVideo ? MAX_VIDEO_MB : MAX_AUDIO_MB;
  if (file.size > limitMb * 1024 * 1024) {
    return `${isVideo ? 'Video' : 'File'} is too large. Maximum size is ${limitMb} MB.`;
  }
  return null;
}
