export async function preparePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Браузер не смог открыть фото. Попробуйте JPEG, PNG или WebP.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', {alpha: false});
    if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error('Не удалось обработать фото.');
    let scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    while (true) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [.86, .72, .58]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) throw new Error('Не удалось сохранить фото.');
        if (blob.size <= 1200 * 1024) return blob;
      }
      scale *= .75;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
