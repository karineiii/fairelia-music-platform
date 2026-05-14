const express = require("express");
const { searchMusic, getStream } = require("../controllers/musicController");

const router = express.Router();

router.get("/search", searchMusic);
router.get("/stream", getStream);

module.exports = router;