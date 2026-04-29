import { getPublicFileUrl } from "./publicFileUrl.js";

export const getFileUrl = (req, filePath) => {
  return getPublicFileUrl({ req, key: filePath });
};

