require("dotenv").config(); // ✅ ADD THIS

const mongoose = require("mongoose");
const Driver = require("./models/Driver");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await Driver.updateMany({}, { status: "available" });

    console.log("✅ All drivers reset to available");

    process.exit();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();