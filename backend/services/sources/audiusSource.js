const AUDIUS_HOST = "https://discoveryprovider.audius.co";

const search = async (query) => {
  const url =
    `${AUDIUS_HOST}/v1/tracks/search?` +
    new URLSearchParams({
      query,
      limit: "20",
      app_name: "Fairélia",
    });

  const response = await fetch(url);
  const data = await response.json();

  const tracks = data.data || [];

  return tracks.map((track) => {
    const streamUrl = `${AUDIUS_HOST}/v1/tracks/${track.id}/stream?app_name=Fairélia`;

    return {
      id: track.id,
      title: track.title || "Untitled",
      artists: [track.user?.name || track.user?.handle || "Audius Artist"],
      artist: track.user?.name || track.user?.handle || "Audius Artist",
      duration: track.duration || null,
      thumbnail:
        track.artwork?.["480x480"] ||
        track.artwork?.["150x150"] ||
        "https://placehold.co/300x300/FFD8E6/9B4D66.png?text=Fair%C3%A9lia",
      coverUrl:
        track.artwork?.["480x480"] ||
        track.artwork?.["150x150"] ||
        "https://placehold.co/300x300/FFD8E6/9B4D66.png?text=Fair%C3%A9lia",
      externalUri: track.permalink || "",
      source: "audius",
      streams: [
        {
          url: streamUrl,
          container: "mp3",
          type: "lossy",
          codec: "mp3",
          bitrate: null,
        },
      ],
      streamUrl,
      downloadUrl: streamUrl,
      siblings: [],
    };
  });
};

module.exports = {
  name: "audius",
  search,
};