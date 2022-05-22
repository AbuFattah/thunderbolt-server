const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const { application } = require("express");

// middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("hellow world!");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sfzyq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

(async function run() {
  try {
    await client.connect();
    console.log(process.env.DB_USER);
    const productCollection = client.db("thunderbolt").collection("products");

    // APIS
    app.get("/featuredProducts", async (req, res) => {
      const query = {};
      const cursor = productCollection.find(query).limit(4);
      const products = await cursor.toArray();
      res.send(products);
    });
    // replace console.dir with your callback to access individual elements
  } finally {
  }
})().catch(console.dir);

app.listen(port, () => {
  console.log("Listening on port", port);
});
