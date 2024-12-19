const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 8080;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const { application } = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const ACCESS_SIGNATURE = process.env.ACCESS_SIGNATURE;
// middlewares
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  //console.log("inside verify jwt");
  //console.log(req.headers);
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  //console.log(authorization);
  const token = authorization.split(" ")[1];
  //console.log(token);
  jwt.verify(token, ACCESS_SIGNATURE, function (err, decoded) {
    if (err) {
      //console.log(err);
      return res.status(403).send({ message: "Forbidden Accesssss" });
    }
    req.decoded = decoded;
    ////console.log("inside VerfiyJWT", authorization);
    next();
  });
};

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
    ////console.log(process.env.DB_USER);
    const productCollection = client.db("thunderbolt").collection("products");
    const reviewCollection = client.db("thunderbolt").collection("reviews");
    const orderCollection = client.db("thunderbolt").collection("orders");
    const userCollection = client.db("thunderbolt").collection("users");

    // MIDDLEWARES
    const verifyAdmin = async (req, res, next) => {
      //console.log("inside verifyAdmin");
      if (!req.decoded) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }

      const { email } = req.decoded;
      ////console.log(email);
      const user = await userCollection.findOne({ email: email });

      if (user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden Acce" });
      }
      next();
    };
    // APIS
    app.get("/featuredProducts", async (req, res) => {
      const query = {};
      const cursor = productCollection.find(query);
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
    app.post("/orders/:productId", verifyJWT, async (req, res) => {
      const productId = req.params.productId;
      let { email, orderQuantity } = req.body;
      orderQuantity = parseInt(orderQuantity);
      // const existingOrder = await orderCollection.findOne({
      //   productId,
      //   email,
      // });
      // if (existingOrder) {
      //   return res.send({ message: "Order already placed", success: false });
      // }
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
    app.get("/orders/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const myOrders = await orderCollection.find(query).toArray();
      res.send(myOrders);
    });
    // get reviews
    app.get("/reviews", async (req, res) => {
      const query = {};
      const reviews = await reviewCollection.find(query).toArray();
      res.send(reviews);
    });
    // POST REVIEWS
    app.post("/reviews", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
    // Get User Profile
    app.get("/userProfile/:email", async (req, res) => {
      const filter = { email: req.params.email };
      const profile = await userCollection.findOne(filter);
      if (!profile) {
        return res.send({ message: "failed to fetch", success: false });
      }
      res.send(profile);
    });
    // Update Profile
    app.put("/updateProfile/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const data = req.body;
      const updatedDoc = {
        $set: {
          ...data,
        },
      };
      const filter = { email: email };
      const options = { upsert: true };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      if (!result.acknowledged) {
        return res.send({ success: false });
      }
      res.send({ ...result, success: true });
    });
    // add user and create access token
    app.put("/users", async (req, res) => {
      //console.log("inside sign in");
      const payload = req.body;
      const { email } = payload;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          ...payload,
        },
      };
      const options = { upsert: true };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      const token = jwt.sign(payload, ACCESS_SIGNATURE, {
        expiresIn: "30d",
      });
      res.send({ token });
    });
    // DELETE ORDER
    app.delete("/orders/:orderId", verifyJWT, async (req, res) => {
      ////console.log("inside delete");
      const id = req.params.orderId;
      const query = { _id: ObjectId(id) };
      const order = await orderCollection.findOne(query);
      if (order.paid) {
        return res.send({
          message: "Payment is already completed",
          success: false,
        });
      }
      const result = await orderCollection.deleteOne(query);
      if (result.deletedCount !== 1) {
        return res.send({ success: false });
      }

      res.send({ success: true });
    });
    // IS ADMIN
    app.get("/isAdmin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email, role: "admin" };
      ////console.log({ query });
      const result = await userCollection.findOne(query);
      if (!result) {
        return res.send({ isAdmin: false });
      }
      ////console.log(result);
      res.send({ isAdmin: true });
    });
    // ADD A Product
    app.post("/products", verifyJWT, verifyAdmin, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });
    // Get orders
    app.get("/orders", async (req, res) => {
      const result = await orderCollection.find({}).toArray();
      res.send(result);
    });
    // Get single order
    app.get("/singleOrder/:id", async (req, res) => {
      const id = req.params.id;
      const order = await orderCollection.findOne({ _id: ObjectId(id) });
      res.send(order);
    });
    // GET AVATAR LINK
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result.avatarLink);
    });
    // UPDATING STATUS TO SHIPPED
    app.patch("/orders/:id", verifyJWT, verifyAdmin, async (req, res) => {
      //console.log("lkfjdlkjalkjflsakfjlkasf");
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "shipped",
        },
      };
      const result = await orderCollection.updateOne(filter, updatedDoc);
      ////console.log(result);
      res.send(result);
    });
    // UPDATE PAYMENT STATUS FOR ORDER
    app.patch("/orders/payment/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { transactionId } = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          status: "pending",
          transactionId: transactionId,
        },
      };
      const result = await orderCollection.updateOne(filter, updatedDoc);
      ////console.log(result);
      res.send(result);
    });
    // Get all products
    app.get("/products", async (req, res) => {
      const products = await productCollection.find({}).toArray();
      res.send(products);
    });
    // delete a product
    app.delete("/products/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await productCollection.deleteOne(filter);
      res.send(result);
    });
    // Make ADMIN
    app.patch("/makeAdmin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });
    // STRIPE PAYMENT
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      let { price } = req.body;
      if (!price || isNaN(price)) {
        return res.status(404).send({ message: "invalid request body" });
      }
      amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
  }
})().catch(console.dir);

app.listen(port, () => {
  console.log("Listening on port", port);
});

// module.exports = app;
