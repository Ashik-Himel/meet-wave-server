const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.xeaidsx.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const database = client.db('MeetWave');
    const meetingLinks = database.collection('meeting-links');
    const allUsersCollection = database.collection('all-users');

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected!!!");


    // users related API
    app.post('/all-users', async (req, res) => {
      const user = req.body;
      console.log(user)
      const query = { email: user?.email };
      const existingUser = await allUsersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exits", insertedId: null })
      };
      const result = await allUsersCollection.insertOne(user);
      console.log(result);
      res.send(result)
    })

    // get all users
    app.get('/all-users', async (req, res) => {
      const result = await allUsersCollection.find().toArray();
      res.send(result)
    })

    // get single user
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await allUsersCollection.findOne(query);
      res.send(result);
    })

    // Update an User status
    app.patch('/user-status/:email', async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const user = await allUsersCollection.findOne({ email: email });
      const updatedStatus = !user.status;
      const result = await allUsersCollection.updateOne(
        { email: email },
        { $set: { status: updatedStatus } }
      );
      res.send(result);
    });


  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("Welcome to MeetWave's server!");
})
app.listen(port, () => {
  console.log(`Server is running in http://localhost:${port} !!!`);
})