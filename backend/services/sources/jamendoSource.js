const JAMENDO_API = "https://api.jamendo.com/v3.0";

const search = async (query) => {
  if (!process.env.JAMENDO_CLIENT_ID) {
    console.log("Jamendo skipped: missing JAMENDO_CLIENT_ID");
    return [];
  }

  const url =
    `${JAMENDO_API}/tracks/?` +
    new URLSearchParams({
      client_id: process.env.JAMENDO_CLIENT_ID,
      format: "json",
      limit: "20",
      search: query,
      include: "musicinfo",
      audioformat: "mp32",
    });

  const response = await fetch(url);
  const data = await response.json();

  const tracks = data.results || [];

  return tracks
    .filter((track) => track.audio)
    .map((track) => ({
      id: String(track.id),
      title: track.name || "Untitled",
      artists: [track.artist_name || "Jamendo Artist"],
      artist: track.artist_name || "Jamendo Artist",
      duration: track.duration || null,
      thumbnail:
        track.album_image ||
        track.image ||
        "https://placehold.co/300x300/FFD8E6/9B4D66.png?text=Fair%C3%A9lia",
      coverUrl:
        track.album_image ||
        track.image ||
        "https://placehold.co/300x300/FFD8E6/9B4D66.png?text=Fair%C3%A9lia",
      externalUri: track.shareurl || "",
      source: "jamendo",
      streams: [
        {
          url: track.audio,
          container: "mp3",
          type: "lossy",
          codec: "mp3",
          bitrate: null,
        },
      ],
      streamUrl: track.audio,
      downloadUrl: track.audiodownload || track.audio,
      license: track.license_ccurl || "Check Jamendo license",
      siblings: [],
    }));
};

module.exports = {
  name: "jamendo",
  search,
};