const { searchArchive } = require("../services/archiveService");

exports.searchMusic = async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const tracks = await searchArchive(query);

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
