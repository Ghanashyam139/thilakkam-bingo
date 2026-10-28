/**
 * Compresses an image file on the client side using Canvas.
 * Resizes the image to fit within maxWidth/maxHeight, and outputs Jpeg with designated quality.
 */
export function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Check if browser environment
    if (typeof window === 'undefined') {
      return reject(new Error('Canvas compression can only run on the client side.'));
    }

    // Verify it's an image
    if (!file.type.startsWith('image/')) {
      return resolve(file); // Don't try to compress non-images
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get 2D context from canvas.'));
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas back to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas compression yielded null blob.'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(new Error('Failed to load image object: ' + err));
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(new Error('Failed to read file: ' + err));
    reader.readAsDataURL(file);
  });
}
