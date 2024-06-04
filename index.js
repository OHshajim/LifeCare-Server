const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


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

        // collections 
        const campsCollections = client.db('LifeCare').collection('Camps');
        const userCollections = client.db('LifeCare').collection('Users');
        const registeredCampCollections = client.db('LifeCare').collection('RegisteredCamps');
        const feedbackCollections = client.db('LifeCare').collection('Feedbacks');

        // ------------Custom Middleware------------
        const verifyToken = (req, res, next) => {
            if (!req.headers.Authorization) {
                return res.status(401).send({ message: 'unauthorized Access' })
            }
            const token = req.headers.Authorization.split(' ')[1];

            jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized Access' })
                }
                req.decoded = decoded;
                console.log(decoded);
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
        // const verifyToken = (req, res, next) => {

        // }
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
            const { search, sort } = filter
            console.log(filter);
            const query = {
                campName: { $regex: search, $options: 'i' },
            }
            const option = {
                // sort: {
                //     'sort': 1
                // }
            }
            const result = await campsCollections.find(query, option).toArray();
            res.send(result)
        })

        // Popular camp
        app.get('/popularCamps', async (req, res) => {
            const result = await campsCollections.find().sort({ 'participantCount': -1 }).limit(6).toArray();
            res.send(result)
        })

        app.get('/camp/:id',verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await campsCollections.findOne(query)
            res.send(result)
        })

        // for Users
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
        app.post('/registeredCamp',verifyToken, async (req, res) => {
            const registeredCamp = req.body;
            const result = await registeredCampCollections.insertOne(registeredCamp);
            const query = { _id: new ObjectId(registeredCamp.campId) }
            const updateParticipatesNum = {
                $inc: {
                    Participant_Count: 1
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