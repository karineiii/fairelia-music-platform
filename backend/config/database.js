const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI || process.env.MONGO_URI === "your_mongodb_url_here") {
      console.log("MongoDB skipped: no valid MONGO_URI");
      return;
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(`MongoDB warning: ${error.message}`);
    console.log("Server will continue without MongoDB for music search.");
  }
};

module.exports = connectDB;
