export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data url prefix for API usage if needed, usually cleaner to keep it for display
      // but API usually needs just the base64 part. 
      // We will strip it in the service layer.
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const stripBase64Prefix = (base64: string): string => {
  return base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
};
