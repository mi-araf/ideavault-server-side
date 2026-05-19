const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

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
    },
});

let ideasCollection;

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
            creatorName: idea.creatorName || "IdeaVault User",
            creatorEmail: idea.creatorEmail || "",
            creatorImage: idea.creatorImage || "",
            likesCount: 0,
            commentsCount: 0,
            bookmarksCount: 0,
            createdAt: new Date().toISOString(),
        };

        const result = await ideasCollection.insertOne(newIdea);
        res.send({ success: true, message: "Idea added successfully", insertedId: result.insertedId });
    } catch (error) {
        res.status(500).send({ success: false, message: "Failed to add idea", error: error.message });
    }
});

app.get("/ideas", async (req, res) => {
    try {
        const result = await ideasCollection.find().sort({ createdAt: -1 }).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ success: false, message: "Failed to load ideas", error: error.message });
    }
});

app.get("/trending-ideas", async (req, res) => {
    try {
        const result = await ideasCollection.aggregate([{ $limit: 6 }]).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ success: false, message: "Failed to load trending ideas", error: error.message });
    }
});

async function run() {
    try {
        await client.connect();
        ideasCollection = client.db("startup-server").collection("ideas");
        await client.db("admin").command({ ping: 1 });
        console.log("Connected to MongoDB!");
    } catch (err) {
        console.error("MongoDB connection failed:", err);
        process.exit(1);
    }
}

run();

app.get("/", (req, res) => res.send("Server is running fine!"));
app.listen(PORT, () => console.log(`Startup ideas server listening on port ${PORT}`));