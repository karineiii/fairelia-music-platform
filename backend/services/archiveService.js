const searchArchive = async (query) => {
  const searchUrl =
    "https://archive.org/advancedsearch.php?" +
    new URLSearchParams({
      q: `collection:(opensource_audio) AND (${query})`,
      fl: "identifier,title,creator",
      rows: "12",
      page: "1",
      output: "json",
    });

  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json();

  const docs = searchData.response?.docs || [];

  const tracks = [];

  for (const item of docs) {
    try {
      const metadataUrl = `https://archive.org/metadata/${item.identifier}`;
      const metadataResponse = await fetch(metadataUrl);
      const metadata = await metadataResponse.json();

      const audioFile = metadata.files?.find((file) => {
        const name = file.name?.toLowerCase() || "";
        return name.endsWith(".mp3") || name.endsWith(".ogg") || name.endsWith(".flac");
      });

      if (!audioFile) continue;

      const streamUrl = `https://archive.org/download/${item.identifier}/${encodeURIComponent(audioFile.name)}`;

      tracks.push({
        id: item.identifier,
        title: item.title || audioFile.name,
        artist: item.creator || "Archive.org Artist",
        source: "archive.org",
        streamUrl,
        downloadUrl: streamUrl,
        duration: audioFile.length || null,
        license: metadata.metadata?.licenseurl || "Check Archive.org item page",
        coverUrl: `https://archive.org/services/img/${item.identifier}`,
      });
    } catch (error) {
      console.log(`Skipped archive item: ${item.identifier}`);
    }
  }

  return tracks;
};

module.exports = {
  searchArchive,
};
