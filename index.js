require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = 5000 || process.env.PORT;

// middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("hellow world!");
});

app.listen(port, () => {
  console.log("Listening on port", port);
});
