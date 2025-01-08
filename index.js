const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
require('dotenv').config()
const port = process.env.PORT || 2000;

// middlewere
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.mhwjc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri)

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
        // await client.connect();

        const database = client.db('bistroBoss')
        const userCollection = database.collection('users')
        const menuCollection = database.collection('menu')
        const reviewCollection = database.collection('testimonials')
        const cartCollection = database.collection('cartItems')


        // user related api

        app.get('/users', async(req, res)=>{
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists', insertId: null })
            }

            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.patch('/dashboard/admin/:id', async(req, res)=>{
            const id = req.params.id
            const filter = {_id: new ObjectId(id)}
            const updatedUser = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedUser)
            res.send(result)
        })

        app.delete('/users/:id', async(req, res)=>{
            const id = req.params.id
            const query = { _id: new ObjectId(id)}
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })


        // menu related api
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        })


        // reviews on homepage
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray()
            res.send(result)
        })


        // cart related API
        app.get('/cartitems', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/cartitems', async (req, res) => {
            const cartItem = req.body
            const result = await cartCollection.insertOne(cartItem)
            res.send(result)
        })

        app.delete('/cartitems/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bistro Boss Restaurant Server')
})

app.listen(port, () => {
    console.log('server is running on port:', port)
})