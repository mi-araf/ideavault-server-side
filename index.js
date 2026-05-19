const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        await client.connect();

        const database = client.db("startup-server");
        const ideasCollection = database.collection("ideas");

        app.get("/ideas", async (req, res) => {
            const cursor = ideasCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get("/trending-ideas", async (req, res) => {
            const result = await ideasCollection
                .aggregate([
                    {
                        $limit: 6
                    }
                ])
                .toArray();

            res.send(result);
        });

        app.post("/ideas", async (req, res) => {
            try {
                const idea = req.body;

                const newIdea = {
                    ideaTitle: idea.ideaTitle,
                    shortDescription: idea.shortDescription,
                    detailedDescription: idea.detailedDescription,
                    category: idea.category,
                    tags: idea.tags || [],
                    imageURL: idea.imageURL,
                    estimatedBudget: idea.estimatedBudget || null,
                    targetAudience: idea.targetAudience,
                    problemStatement: idea.problemStatement,
                    proposedSolution: idea.proposedSolution,
                    creatorName: idea.creatorName,
                    creatorEmail: idea.creatorEmail,
                    creatorImage: idea.creatorImage || "",
                    likesCount: 0,
                    commentsCount: 0,
                    bookmarksCount: 0,
                    createdAt: new Date().toISOString(),
                };

                const result = await ideasCollection.insertOne(newIdea);

                res.send({
                    success: true,
                    message: "Idea added successfully",
                    insertedId: result.insertedId,
                });
            } catch (error) {
                res.status(500).send({
                    success: false,
                    message: "Failed to add idea",
                    error: error.message,
                });
            }
        });


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Server is running fine!");
});

app.listen(PORT, () => {
    console.log(`Startup ideas server listening on port ${PORT}`);
});