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
    const reviewCollection = client.db("thunderbolt").collection("reviews");
    const orderCollection = client.db("thunderbolt").collection("orders");

    // APIS
    app.get("/featuredProducts", async (req, res) => {
      const query = {};
      const cursor = productCollection.find(query).limit(3);
      const products = await cursor.toArray();
      res.send(products);
    });

    // Find products by id
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });
    // place order
    app.post("/orders/:productId", async (req, res) => {
      const productId = req.params.productId;
      const { email, orderQuantity } = req.body;

      const existingOrder = await orderCollection.findOne({
        productId,
        email,
      });
      if (existingOrder) {
        return res.send({ message: "Order already placed", success: false });
      }
      const updateProducts = {
        $inc: { quantity: -orderQuantity },
      };
      await productCollection.updateOne(
        { _id: ObjectId(productId) },
        updateProducts
      );
      const doc = { ...req.body, productId, paid: false };

      const result = await orderCollection.insertOne(doc);
      res.send({ success: true, ...result });
    });
    // Get my orders
    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const myOrders = await orderCollection.find(query).toArray();
      res.send(myOrders);
    });
    app.get("/reviews", async (req, res) => {
      const query = {};
      const reviews = await reviewCollection.find(query).toArray();
      res.send(reviews);
    });
  } finally {
  }
})().catch(console.dir);

app.listen(port, () => {
  console.log("Listening on port", port);
});
