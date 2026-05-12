const EXTRA_API_CONFIG_URL =
  "https://raw.githubusercontent.com/BlackHatDevX/openspot-config/refs/heads/main/ytmusicextraapi.json";

let cachedInstances = null;
let lastWorkingInstance = null;
let lastFetchTime = 0;

const CACHE_TIME = 10 * 60 * 1000;

const fetchWithTimeout = async (url, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const getInstances = async () => {
  const now = Date.now();

  if (cachedInstances && now - lastFetchTime < CACHE_TIME) {
    return cachedInstances;
  }

  try {
    const response = await fetchWithTimeout(EXTRA_API_CONFIG_URL, 5000);
    const config = await response.json();

    const instances =
      config.ytmusic_extra_apis
        ?.map((api) => api.url?.replace(/\/$/, ""))
        .filter(Boolean) || [];

    cachedInstances = instances;
    lastFetchTime = now;

    return instances;
  } catch (error) {
    console.log("YTMusic config failed:", error.message);

    return cachedInstances || [];
  }
};

const getOrderedInstances = async () => {
  const instances = await getInstances();

  if (lastWorkingInstance && instances.includes(lastWorkingInstance)) {
    return [
      lastWorkingInstance,
      ...instances.filter((instance) => instance !== lastWorkingInstance),
    ];
  }

  return instances;
};

const fetchFromAnyInstance = async (path) => {
  const instances = await getOrderedInstances();

  let lastError = null;

  for (const instance of instances) {
    try {
      const response = await fetchWithTimeout(`${instance}${path}`, 8000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      lastWorkingInstance = instance;

      return {
        data: await response.json(),
        instance,
      };
    } catch (error) {
      console.log(`YTMusic instance failed ${instance}: ${error.message}`);
      lastError = error;

      if (instance === lastWorkingInstance) {
        lastWorkingInstance = null;
      }
    }
  }

  throw new Error(`All YouTube Music instances failed: ${lastError?.message}`);
};

const getBestThumbnail = (item) => {
  if (item.videoId) {
    return `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
  }

  return item.videoThumbnails?.[0]?.url || "";
};

const search = async (query) => {
  const { data } = await fetchFromAnyInstance(
    `/api/v1/search?q=${encodeURIComponent(
      query
    )}&type=video&fields=videoId,title,author,lengthSeconds,videoThumbnails`
  );

  const seen = new Set();

  return data
    .filter((item) => item.videoId && !seen.has(item.videoId))
    .map((item) => {
      seen.add(item.videoId);

      const coverUrl =
        getBestThumbnail(item) ||
        "https://placehold.co/300x300/FFD8E6/9B4D66.png?text=Fair%C3%A9lia";

      return {
        id: item.videoId,
        title: item.title || "Unknown title",
        artists: [item.author || "YouTube Music Artist"],
        artist: item.author || "YouTube Music Artist",
        duration: item.lengthSeconds || null,
        thumbnail: coverUrl,
        coverUrl,
        externalUri: `https://music.youtube.com/watch?v=${item.videoId}`,
        source: "ytmusic",
        streams: [],
        streamUrl: "",
        downloadUrl: "",
        siblings: [],
      };
    });
};

const pickBestAudioFormat = (adaptiveFormats = [], instance, trackId) => {
  const audioFormats = adaptiveFormats
    .filter((format) => (format.type || "").startsWith("audio/"))
    .sort((a, b) => {
      const aIsMp4 = (a.type || "").includes("audio/mp4") ? 1 : 0;
      const bIsMp4 = (b.type || "").includes("audio/mp4") ? 1 : 0;

      if (aIsMp4 !== bIsMp4) return bIsMp4 - aIsMp4;

      return (b.bitrate || 0) - (a.bitrate || 0);
    });

  if (!audioFormats.length) {
    throw new Error("No audio formats found");
  }

  const best = audioFormats[0];

  if (best.itag) {
    return `${instance}/latest_version?id=${encodeURIComponent(
      trackId
    )}&itag=${best.itag}&local=true`;
  }

  if (best.url) return best.url;

  throw new Error("No usable audio URL");
};

const getStreamUrl = async (trackId) => {
  const { data, instance } = await fetchFromAnyInstance(
    `/api/v1/videos/${encodeURIComponent(
      trackId
    )}?fields=adaptiveFormats`
  );

  return pickBestAudioFormat(data.adaptiveFormats, instance, trackId);
};

module.exports = {
  name: "ytmusic",
  search,
  getStreamUrl,
};