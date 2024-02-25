const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const nodemailer = require('nodemailer');
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./FirebaseServiceKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
const port = process.env.PORT || 5001;

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://meet-wave.vercel.app"
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

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
    const userCollection = database.collection('users');
    const feedbackCollection = database.collection('feedbacks');

    // Middlewares
    const verifyUser = (req, res, next) => {
      const token = req.cookies?.token;
      if (!token)
        return res.status(403).send({
          message: "Token Missing",
        });

      jwt.verify(token, process.env.JWT_STRING, (err, decode) => {
        if (err || req.headers?.authorization !== decode?.email) {
          return res.status(401).send({
            message: "Unauthorize access",
          });
        }

        req.userEmail = decode?.email;
        next();
      });
    };
    const verifyAdmin = async (req, res, next) => {
      const filter = { email: req.userEmail };
      const user = await userCollection.findOne(filter);

      if (user?.role !== "admin")
        return res.status(401).send({
          message: "Unauthorize access",
        });
      next();
    };

    // Users Api
    app.get("/users", verifyUser, verifyAdmin, async (req, res) => {
      // let filter = {};
      // if (req.query?.search) {
      //   filter = { name: { $regex: req.query.search, $options: 'i' } }
      // }
      // const result = await userCollection.find(filter).skip(req.query?.skip * 10).limit(10).toArray();
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const token = jwt.sign({ email: req.body?.email }, process.env.JWT_STRING, { expiresIn: "7d" });
      const filter = { email: req.body?.email };
      const config = {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };
      const userMatched = await userCollection.findOne(filter);

      if (!userMatched) {
        const document = {
          name: req.body?.name,
          email: req.body?.email,
          photo: req.body?.photo,
          uid: req.body?.uid,
          role: "user",
          status: "active"
        };
        const result = await userCollection.insertOne(document);
        res.cookie("token", token, config).send(result);
      } else {
        res.cookie("token", token, config).send(userMatched);
      }
    });
    app.put('/users', verifyUser, verifyAdmin, async(req, res) => {
      const filter = {email: req.query?.email};
      const document = {
        $set: req.body
      };
      const result = await userCollection.updateOne(filter, document);
      res.send(result);
    })
    
    // firebase disable
      app.post('/users-disable',verifyUser,verifyAdmin, async(req,res)=>{
           try{
            console.log('asi ra frei')
          const {firebaseUID}=req.body
          await admin.auth().updateUser(firebaseUID,{disabled:true})
          res.status(200).json({message:"User disable successfully"})
           }
           catch(error){
            console.log('agun lagsa ra')
            res.status(500).json({ error: 'Something went wrong' });
           }

      })
      // firebase user enable

      app.post('/users-enable',verifyUser,verifyAdmin, async(req,res)=>{
        try{
       const {firebaseUID}=req.body
       await admin.auth().updateUser(firebaseUID,{disabled: false})
       res.status(200).json({message:"User disable successfully"})
        }
        catch(error){
         res.status(500).json({ error: 'Something went wrong' });
        }

   })

    app.get("/logout", verifyUser, (req, res) => {
      res.clearCookie("token").send("Ok");
    });
    app.get("/user-role", async (req, res) => {
      
      const filter = { email: req.query?.email };
      const result = await userCollection.findOne(filter);
      res.send(result);
    });
    app.get("/user-status", async(req, res) => {
      const filter = { email: req.query?.email };
      const result = await userCollection.findOne(filter);
      res.send({status: result?.status});
    })
    app.get("/users-count", verifyUser, verifyAdmin, async (req, res) => {
      const totalUsers = await userCollection.countDocuments();
      const blockedUsers = await userCollection.countDocuments({status: "disabled"});
      res.send({totalUsers, blockedUsers});
    });

    // Feedback API
    app.get("/feedbacks", async(req, res) => {
      // const result = await userCollection.find().skip(req.query?.skip * 10).limit(10).toArray();
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    })
    app.post("/feedbacks", verifyUser, async(req, res) => {
      const result = await feedbackCollection.insertOne(req.body);
      res.send(result);
    })
    app.get("/feedbacks-count", verifyUser, verifyAdmin, async(req, res) => {
      const result = await feedbackCollection.countDocuments();
      res.send({totalFeedbacks: result});
    })



    // nodeMailer

    app.post('/send-email', async (req, res) => {
      try {
          console.log(req.body);
        const { firstName, lastName, email, phone, text } = req.body;
    
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
        });
    
        const info = await transporter.sendMail({
          from: email,
          to: "tusharimran470@gmail.com",
          subject: "Contact Form Submission",
          text: `Name: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${text}`,
        });
    
        console.log("Message sent: %s", info.messageId);
        res.json({ message: "Email sent successfully" });
      } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send email" });
      }
    });



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected!!!");
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

module.exports = app;