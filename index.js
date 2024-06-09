const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_KEY);


// middleware
app.use(cors());
app.use(express.json());


// mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q9eobgc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // -------------collections---------------
        const campsCollections = client.db('LifeCare').collection('Camps');
        const userCollections = client.db('LifeCare').collection('Users');
        const registeredCampCollections = client.db('LifeCare').collection('RegisteredCamps');
        const feedbackCollections = client.db('LifeCare').collection('Feedbacks');
        const paymentCollections = client.db('LifeCare').collection('Payment');

        // ------------Custom Middleware------------
        const verifyToken = (req, res, next) => {
            // console.log(req.headers);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized Access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_KEY, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized Access' })
                }
                req.decoded = decoded;
                next()
            })
        }
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email };
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden Access' })
            }
            next()
        }

        // ------------APIs------------

        // JWT
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_KEY, {
                expiresIn: '1h'
            })
            res.send({ token })
        })


        // for camps
        app.get('/camps', async (req, res) => {
            const filter = req.query;
            const { search, sortBy } = filter
            console.log(filter);
            const query = {
                campName: { $regex: search, $options: 'i' },
            }

            if (sortBy === '') {

                const result = await campsCollections.find(query).toArray();
                return res.send(result)
            }
            else {
                const result = await campsCollections.find(query).sort(sortBy).toArray();
                return res.send(result)
            }
        })

        // Popular camp
        app.get('/popularCamps', async (req, res) => {
            const result = await campsCollections.find().sort({ 'participantCount': -1 }).limit(6).toArray();
            res.send(result)
        })
        app.get('/allCamps', async (req, res) => {
            const result = await campsCollections.find().toArray();
            res.send(result)
        })

        app.get('/camp/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await campsCollections.findOne(query)
            res.send(result)
        })
        app.patch('/update-camp/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const camp = req.body;
            const updatedCamp = {
                $set: {
                    ...camp
                }
            }
            const result = await campsCollections.updateOne(query, updatedCamp)
            res.send(result)
        })
        app.delete('/delete-camp/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await campsCollections.deleteOne(query)
            res.send(result)
        })

        app.post('/camps', (req, res) => {
            const newCamp = req.body;
            const result = campsCollections.insertOne(newCamp);
            res.send(result)
        })


        // for Users


        app.get('/user/organizer/:email', verifyToken, async (req, res) => { // Organizer
            const email = req.params.email;
            const query = { email: email }
            const user = await userCollections.findOne(query)
            let organizer = false;
            if (user) {
                organizer = user?.role === 'organizer'
            }
            res.send({ organizer })
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const isExist = await userCollections.findOne(query);
            if (isExist) {
                return res.send({ message: `welcome Back ! ${user.name}`, insertedId: null });
            };
            const result = await userCollections.insertOne(user);
            res.send(result)
        })

        // for registered camps

        app.get('/registeredCamps/:email', verifyToken, async (req, res) => { // Organizer
            const email = req.params.email;
            const query = { participantEmail: email }
            const result = await registeredCampCollections.find(query).toArray()
            res.send(result)
        })
        app.get('/registeredCamp/:id', verifyToken, async (req, res) => { // Organizer
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await registeredCampCollections.findOne(query)
            res.send(result)
        })

        app.post('/registeredCamp', verifyToken, async (req, res) => {
            const registeredCamp = req.body;
            const result = await registeredCampCollections.insertOne(registeredCamp);
            const query = { _id: new ObjectId(registeredCamp.campId) }
            const updateParticipatesNum = {
                $inc: {
                    participantCount: 1
                }
            }
            if (result) {
                await campsCollections.updateOne(query, updateParticipatesNum)
            }
            res.send(result)
        })


        // for feedbacks
        app.get('/feedbacks', async (req, res) => {
            const result = await feedbackCollections.find().toArray();
            res.send(result)
        })

        // Payment 
        app.post('/create-payment-intent',verifyToken, async (req, res) => {
            const { fees } = req.body;
            const amount = parseInt(fees * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "eur",
                payment_method_types: ["card"],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.get('/paidCamps/:email',verifyToken, async (req, res) => {
            const email = req.params.email
            const filter = { email: email }
            const result = await paymentCollections.find(filter).toArray()
            res.send(result)
        })

        app.post('/payment',verifyToken, async (req, res) => {
            const payment = req.body;
            const result = await paymentCollections.insertOne(payment);
            const query = { _id: new ObjectId(payment.campId) }
            const updatedDoc = {
                $set: {
                    paymentStatus: 'paid'
                }
            }
            if (result.insertedId) {
                const res = await registeredCampCollections.updateOne(query, updatedDoc)
            }
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// server running test
app.get('/', (req, res) => {
    res.send('LifeCare server running ...')
})

app.listen(port, () => {
    console.log(`medical Camp server listening on port ${port}`)
})