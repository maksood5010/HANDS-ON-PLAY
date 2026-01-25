// Utility function to get file URL
export const getFileUrl = (req, filePath) => {
  return `${req.protocol}://${req.get('host')}/uploads/${filePath}`;
};

