const express = require("express");
const { searchMusic } = require("../controllers/musicController");

const router = express.Router();

router.get("/search", searchMusic);

module.exports = router;
