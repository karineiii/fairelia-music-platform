const ytmusicSource = require("./sources/ytmusicSource");
const jamendoSource = require("./sources/jamendoSource");

const sources = [ytmusicSource, jamendoSource];

const searchAllSources = async (query) => {
  const allResults = [];

  for (const source of sources) {
    try {
      const results = await source.search(query);
      allResults.push(...results);
    } catch (error) {
      console.log(`${source.name} failed: ${error.message}`);
    }
  }

  return allResults;
};

const getStreamFromSource = async (source, id) => {
  if (source === "ytmusic") {
    return ytmusicSource.getStreamUrl(id);
  }

  if (source === "jamendo") {
    throw new Error("Jamendo stream is already returned during search");
  }

  throw new Error(`Unknown source: ${source}`);
};

module.exports = {
  searchAllSources,
  getStreamFromSource,
};