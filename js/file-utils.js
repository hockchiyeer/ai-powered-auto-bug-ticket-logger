(function registerFileUtils() {
  window.BugGenie = window.BugGenie || {};

  const createAssetId = () => {
    return `${Math.random().toString(36).slice(2, 11)}${Date.now()}`;
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
    });
  };

  const getFullBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
  };

  const getImageDataUrls = async (assets = []) => {
    return Promise.all(
      assets
        .filter((asset) => asset.type === "image")
        .map(async (asset) => ({
          name: asset.name,
          data: await getFullBase64(asset.file)
        }))
    );
  };

  const releaseFilePreviews = (assets = []) => {
    assets.forEach((asset) => {
      if (asset.preview) {
        URL.revokeObjectURL(asset.preview);
      }
    });
  };

  const mapIncomingFiles = (incomingFiles = []) => {
    return incomingFiles.map((file) => {
      const fileName = file.name.toLowerCase();
      const fileType = (file.type || "").toLowerCase();
      let type = "text";

      if (fileType.includes("image") || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(fileName)) {
        type = "image";
      } else if (fileType.includes("video") || /\.(mp4|webm|ogg|mov|avi)$/.test(fileName)) {
        type = "video";
      } else if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
        type = "pdf";
      } else if (
        fileType.includes("word") ||
        fileName.endsWith(".doc") ||
        fileName.endsWith(".docx")
      ) {
        type = "doc";
      } else if (fileType.includes("text") || fileName.endsWith(".txt") || fileName.endsWith(".log")) {
        type = "text";
      }

      return {
        id: createAssetId(),
        file,
        preview: type === "image" ? URL.createObjectURL(file) : null,
        type,
        name: file.name
      };
    });
  };

  window.BugGenie.fileUtils = {
    fileToBase64,
    getFullBase64,
    getImageDataUrls,
    releaseFilePreviews,
    mapIncomingFiles
  };
})();
