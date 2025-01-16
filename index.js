const express = require("express");
const cors = require("cors");
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
var jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express()
const port = process.env.PORT || 2000;

// middlewere
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.mhwjc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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
        const paymentCollection = database.collection('payments')



        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers)

            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded
                console.log({ decoded })
                next();
            })
        }


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }



        // jwt related token
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '6  h' })
            res.send({ token })
        })


        // user related api

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

            const result = await userCollection.find().toArray()
            res.send(result)
        })


        app.post('/users', verifyToken, async (req, res) => {
            const user = req.body

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists', insertId: null })
            }

            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        // make admin
        app.patch('/dashboard/admin/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedUser = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedUser)
            res.send(result)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })


        // admin check
        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin })
        })


        // menu related api
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        })

        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: id }
            const result = await menuCollection.findOne(query)
            res.send(result)
        })

        app.put('/menu/:id', async (req, res) => {
            const id = req.params.id
            const item = req.body
            const filter = { _id: id }
            const updateDocument = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe,

                },
            };
            const options = { upsert: true }
            const result = await menuCollection.updateOne(filter, updateDocument, options)
            res.send(result)
        })

        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const menuItem = req.body
            const result = await menuCollection.insertOne(menuItem)
            res.send(result)

        })

        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) || id }
            const result = await menuCollection.deleteOne(query)
            res.send(result)
        })


        // reviews on homepage
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray()
            res.send(result)
        })


        // cart related API

        app.get('/cartitems', async (req, res) => {
            const result = await cartCollection.find().toArray()
            res.send(result)
        })

        app.get('/cartitems/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/cartitems', async (req, res) => {
            const cartItem = req.body
            const result = await cartCollection.insertOne(cartItem)
            res.send(result)
        })

        app.delete('/cartitem/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })

        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body

            if (!price || isNaN(price)) {
                return res.status(400).send({ error: 'Invalid price' });
            }
            try {
                const amount = parseInt(price * 100)
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card']
                })
                res.send({
                    clientSecret: paymentIntent.client_secret
                })

            } catch (error) {
                console.error('Error creating payment intent:', error);
                res.status(500).send({ error: 'Internal Server Error' });
            }

        })

        
        
        // transactions
        app.get('/payments/:email',verifyToken, async(req, res)=>{
            const email = req.params.email
            const query = {email : email}
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/payments',verifyToken, async (req, res) => {
            const payment = req.body
            const payResult = await paymentCollection.insertOne(payment)
            console.log('payment info', payment)

            // delete items from cart
            const query = {_id: {
                $in: payment.cartIds.map(id => new ObjectId(id))
            }}
            const deleteResult = await cartCollection.deleteMany(query) 
            console.log(deleteResult)

            res.send({payResult, deleteResult})
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