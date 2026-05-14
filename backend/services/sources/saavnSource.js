const axios = require("axios");
const CryptoJS = require("crypto-js");

const SAAVN_API_URL =
  process.env.SAAVN_API_BASE_URL || "https://www.jiosaavn.com/api.php";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1",
];

const getRandomUserAgent = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const buildApiUrl = (endpoint, params = {}) => {
  const url = new URL(SAAVN_API_URL);

  url.searchParams.append("__call", endpoint);
  url.searchParams.append("_format", "json");
  url.searchParams.append("_marker", "0");
  url.searchParams.append("api_version", "4");
  url.searchParams.append("ctx", "web6dot0");

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });

  return url.toString();
};

const fetchJioSaavn = async (endpoint, params = {}) => {
  const url = buildApiUrl(endpoint, params);

  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": getRandomUserAgent(),
    },
    timeout: 15000,
  });

  return response.data;
};

const decodeHtmlEntities = (text = "") => {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
};

const createDownloadLinks = (encryptedMediaUrl) => {
  if (!encryptedMediaUrl) return [];

  const qualities = [
    { id: "_12", bitrate: "12kbps" },
    { id: "_48", bitrate: "48kbps" },
    { id: "_96", bitrate: "96kbps" },
    { id: "_160", bitrate: "160kbps" },
    { id: "_320", bitrate: "320kbps" },
  ];

  const key = CryptoJS.enc.Utf8.parse("38346591");
  const iv = CryptoJS.enc.Utf8.parse("00000000");

  const decrypted = CryptoJS.DES.decrypt(encryptedMediaUrl, key, {
    iv,
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });

  const decryptedLink = decrypted.toString(CryptoJS.enc.Utf8);

  if (!decryptedLink) return [];

  return qualities.map((quality) => ({
    quality: quality.bitrate,
    url: decryptedLink.replace("_96", quality.id),
  }));
};

const createImageLinks = (link = "") => {
  if (!link) return { small: "", thumbnail: "", large: "" };

  const protocolFixed = link.replace(/^http:\/\//, "https://");

  return {
    small: protocolFixed.replace(/150x150|50x50|500x500/g, "50x50"),
    thumbnail: protocolFixed.replace(/150x150|50x50|500x500/g, "150x150"),
    large: protocolFixed.replace(/150x150|50x50|500x500/g, "500x500"),
  };
};

const extractSongs = (data) => {
  return data?.response?.songs || data?.songs || data?.results || [];
};

const getStreamUrl = async (trackId) => {
  const data = await fetchJioSaavn("song.getDetails", { pids: trackId });

  const song = data?.songs?.[0];

  if (!song) {
    throw new Error("No song data found");
  }

  const encryptedMediaUrl = song.more_info?.encrypted_media_url;

  if (!encryptedMediaUrl) {
    throw new Error("No encrypted media URL found");
  }

  const links = createDownloadLinks(encryptedMediaUrl);

  const best =
    links.find((link) => link.quality === "320kbps") ||
    links.find((link) => link.quality === "160kbps") ||
    links.find((link) => link.quality === "96kbps") ||
    links[0];

  if (!best?.url) {
    throw new Error("No stream URL found");
  }

  return best.url;
};

const transformSong = async (item) => {
  const title = decodeHtmlEntities(item.title || item.song || "Unknown title");

  const artist =
    decodeHtmlEntities(
      item.more_info?.artistMap?.primary_artists?.[0]?.name ||
        item.artists?.primary?.[0]?.name ||
        item.primary_artists ||
        item.singers ||
        "Unknown Artist"
    );

  const images = createImageLinks(item.image || "");

  let streamUrl = "";

  try {
    streamUrl = await getStreamUrl(item.id);
  } catch (error) {
    console.log(`Saavn stream skipped for ${title}: ${error.message}`);
  }

  return {
    id: String(item.id),
    title,
    artists: [artist],
    artist,
    duration: Number(item.more_info?.duration || item.duration || 0),
    thumbnail: images.large || images.thumbnail || images.small,
    coverUrl:
      images.large ||
      images.thumbnail ||
      images.small ||
      "https://placehold.co/300x300/FFD8E6/9B4D66.png?text=Fair%C3%A9lia",
    externalUri: item.perma_url || item.url || "",
    source: "saavn",
    streams: streamUrl
      ? [
          {
            url: streamUrl,
            container: "mp3",
            type: "lossy",
            codec: "mp3",
            bitrate: 320,
          },
        ]
      : [],
    streamUrl,
    downloadUrl: streamUrl,
    siblings: [],
  };
};

const search = async (query) => {
  const data = await fetchJioSaavn("search.getResults", {
    q: query,
    p: 1,
    n: 15,
  });

  const songs = extractSongs(data);

  const tracks = await Promise.all(songs.map(transformSong));

  return tracks.filter((track) => track.streamUrl);
};

module.exports = {
  name: "saavn",
  search,
};