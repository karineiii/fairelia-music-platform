require("dotenv").config();

const connectDB = require("./config/database");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const musicRoutes = require("./routes/music");

connectDB();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());
app.use(morgan("dev"));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Fairélia backend is running 🎵",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Fairélia",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Fairélia backend running on port ${PORT}`);
});
