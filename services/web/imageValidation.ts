export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LISTING_IMAGES = 5;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

const ALLOWED_IMAGE_TYPES = new Set(IMAGE_ACCEPT.split(','));

export const validateImageFile = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Only JPG, PNG, and WEBP images are supported.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Each image must be 5MB or smaller.';
  }
  return null;
};

export const validateListingImages = (existingCount: number, files: File[]): string | null => {
  if (existingCount + files.length > MAX_LISTING_IMAGES) {
    return `You can upload up to ${MAX_LISTING_IMAGES} images.`;
  }
  for (const file of files) {
    const error = validateImageFile(file);
    if (error) return error;
  }
  return null;
};
