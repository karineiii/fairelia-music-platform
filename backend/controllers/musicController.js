const {
  searchAllSources,
  getStreamFromSource,
} = require("../services/sourceManager");

exports.searchMusic = async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const tracks = await searchAllSources(query);

    res.json({
      query,
      count: tracks.length,
      tracks,
    });
  } catch (error) {
    res.status(500).json({
      message: "Music search failed",
      error: error.message,
    });
  }
};

exports.getStream = async (req, res) => {
  try {
    const { source, id } = req.query;

    if (!source || !id) {
      return res.status(400).json({
        message: "source and id are required",
      });
    }

    const streamUrl = await getStreamFromSource(source, id);

    res.json({
      id,
      source,
      streamUrl,
    });
  } catch (error) {
    res.status(500).json({
      message: "Stream failed",
      error: error.message,
    });
  }
};