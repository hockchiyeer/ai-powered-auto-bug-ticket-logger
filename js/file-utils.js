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
    return incomingFiles.map((file) => ({
      id: createAssetId(),
      file,
      preview: file.type.includes("image") ? URL.createObjectURL(file) : null,
      type: file.type.includes("image")
        ? "image"
        : file.type.includes("video")
          ? "video"
          : "text",
      name: file.name
    }));
  };

  window.BugGenie.fileUtils = {
    fileToBase64,
    getFullBase64,
    getImageDataUrls,
    releaseFilePreviews,
    mapIncomingFiles
  };
})();
