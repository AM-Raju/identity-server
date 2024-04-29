const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("identity");
    const usersCollection = db.collection("users");
    const productsCollection = db.collection("products");
    const categoriesCollection = db.collection("categories");
    const ordersCollection = db.collection("orders");

    // User Registration
    app.post("/api/v1/register", async (req, res) => {
      const { username, email, password } = req.body;
      console.log(username, email, password);
      // Check if email already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exist!!!",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into the database
      await usersCollection.insertOne({
        username,
        email,
        password: hashedPassword,
        role: "user",
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully!",
      });
    });

    // User Login
    app.post("/api/v1/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { email: user.email, role: user.role },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.EXPIRES_IN,
        }
      );

      res.json({
        success: true,
        message: "User successfully logged in!",
        accessToken: token,
      });
    });

    /* Auth code ends */

    /* ======= User Block ========== */
    // Get single user

    app.get("/api/v1/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      let result;
      if (email) {
        result = await usersCollection.findOne(query);
      }
      res.send(result);
    });

    /* ======= category Block ========== */

    app.get("/categories", async (req, res) => {
      const result = await categoriesCollection
        .find()
        .sort({ name: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/dresses/:category", async (req, res) => {
      const category = req.params.category;

      const result = await categoriesCollection
        .aggregate([
          // Stage one

          {
            $lookup: {
              from: "products",
              localField: "slug",
              foreignField: "category",
              as: "dresses",
            },
          },

          // Stage two
          {
            $match: {
              slug: category,
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    /* ======= Dress Block ========== */

    app.get("/all-products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });

    app.get("/flash-products", async (req, res) => {
      const query = { flashSale: true };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;

      const productId = new ObjectId(id);
      const query = { _id: productId };

      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    app.get("/top-reviews", async (req, res) => {
      const result = await productsCollection
        .find()
        .sort({ ratings: -1 })
        .toArray();
      res.send(result);
    });

    /* ======= Order Block ========== */
    app.post("/create-order", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    app.get("/orders", async (req, res) => {
      const result = await ordersCollection.find().toArray();
      res.send(result);
    });

    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const query = { orderedBy: email };
      let result;
      if (email) {
        result = await ordersCollection.find(query).toArray();
      }
      res.send(result);
    });
    /* ======= Review Block ========== */

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  const serverStatus = {
    message: "Server is running smoothly",
    timestamp: new Date(),
  };
  res.json(serverStatus);
});
