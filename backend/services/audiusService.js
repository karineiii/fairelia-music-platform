const AUDIUS_HOST = "https://discoveryprovider.audius.co";

const searchAudius = async (query) => {
  const searchUrl =
    `${AUDIUS_HOST}/v1/tracks/search?` +
    new URLSearchParams({
      query,
      limit: "20",
      app_name: "Fairélia",
    });

  const response = await fetch(searchUrl);
  const data = await response.json();

  const tracks = data.data || [];

  return tracks.map((track) => ({
    id: track.id,
    title: track.title || "Untitled",
    artist: track.user?.name || track.user?.handle || "Audius Artist",
    source: "audius",
    streamUrl: `${AUDIUS_HOST}/v1/tracks/${track.id}/stream?app_name=Fairélia`,
    downloadUrl: `${AUDIUS_HOST}/v1/tracks/${track.id}/stream?app_name=Fairélia`,
    coverUrl:
      track.artwork?.["480x480"] ||
      track.artwork?.["150x150"] ||
      "https://placehold.co/300x300/FFD8E6/9B4D66.png?text=Fair%C3%A9lia",
    duration: track.duration || null,
  }));
};

module.exports = {
  searchAudius,
};