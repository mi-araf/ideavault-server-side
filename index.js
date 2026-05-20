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
    },
});

let ideasCollection;
let commentsCollection;
let bookmarksCollection;

/* Root Route */
app.get("/", (req, res) => {
    res.send("Server is running fine!");
});

/* Add Idea */
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

/* Get All Ideas + Search + Filter */
app.get("/ideas", async (req, res) => {
    try {
        const { search, category, fromDate, toDate } = req.query;

        const query = {};

        /*
            Search by idea title
            Case-insensitive using MongoDB $regex + $options: "i"
            Example: /ideas?search=ai
        */
        if (search) {
            query.ideaTitle = {
                $regex: search,
                $options: "i",
            };
        }

        /*
            Filter by category
            Example: /ideas?category=Tech
        */
        if (category && category !== "All") {
            query.category = category;
        }

        /*
            Optional date range filter
            Your createdAt is saved as ISO string:
            new Date().toISOString()
            So string comparison works correctly for ISO date format.
            Example:
            /ideas?fromDate=2026-05-01&toDate=2026-05-20
        */
        if (fromDate || toDate) {
            query.createdAt = {};

            if (fromDate) {
                query.createdAt.$gte = `${fromDate}T00:00:00.000Z`;
            }

            if (toDate) {
                query.createdAt.$lte = `${toDate}T23:59:59.999Z`;
            }
        }

        const result = await ideasCollection
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        res.send(result);
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to load ideas",
            error: error.message,
        });
    }
});

/* Trending Ideas - Simple 6 Ideas using $limit */
app.get("/trending-ideas", async (req, res) => {
    try {
        const result = await ideasCollection
            .aggregate([
                {
                    $limit: 6,
                },
            ])
            .toArray();

        res.send(result);
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to load trending ideas",
            error: error.message,
        });
    }
});

/* Get Single Idea Details */
app.get("/ideas/:id", async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid idea id",
            });
        }

        const result = await ideasCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!result) {
            return res.status(404).send({
                success: false,
                message: "Idea not found",
            });
        }

        res.send(result);
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to load idea details",
            error: error.message,
        });
    }
});

/* Get Comments For One Idea */
app.get("/ideas/:id/comments", async (req, res) => {
    try {
        const ideaId = req.params.id;

        const result = await commentsCollection
            .find({ ideaId })
            .sort({ createdAt: -1 })
            .toArray();

        res.send(result);
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to load comments",
            error: error.message,
        });
    }
});

/* Add Comment */
app.post("/ideas/:id/comments", async (req, res) => {
    try {
        const ideaId = req.params.id;
        const comment = req.body;

        const newComment = {
            ideaId,
            userName: comment.userName || "IdeaVault User",
            userEmail: comment.userEmail || "",
            userImage: comment.userImage || "",
            commentText: comment.commentText,
            createdAt: new Date().toISOString(),
            updatedAt: null,
        };

        const result = await commentsCollection.insertOne(newComment);

        await ideasCollection.updateOne(
            { _id: new ObjectId(ideaId) },
            { $inc: { commentsCount: 1 } }
        );

        res.send({
            success: true,
            message: "Comment added successfully",
            insertedId: result.insertedId,
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to add comment",
            error: error.message,
        });
    }
});

/* Update Own Comment */
app.patch("/comments/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { commentText, userEmail } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid comment id",
            });
        }

        const result = await commentsCollection.updateOne(
            {
                _id: new ObjectId(id),
                userEmail,
            },
            {
                $set: {
                    commentText,
                    updatedAt: new Date().toISOString(),
                },
            }
        );

        res.send({
            success: result.modifiedCount > 0,
            message:
                result.modifiedCount > 0
                    ? "Comment updated successfully"
                    : "You can only update your own comment",
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to update comment",
            error: error.message,
        });
    }
});

/* Delete Own Comment */
app.delete("/comments/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { userEmail, ideaId } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid comment id",
            });
        }

        const result = await commentsCollection.deleteOne({
            _id: new ObjectId(id),
            userEmail,
        });

        if (result.deletedCount > 0 && ObjectId.isValid(ideaId)) {
            await ideasCollection.updateOne(
                { _id: new ObjectId(ideaId) },
                { $inc: { commentsCount: -1 } }
            );
        }

        res.send({
            success: result.deletedCount > 0,
            message:
                result.deletedCount > 0
                    ? "Comment deleted successfully"
                    : "You can only delete your own comment",
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to delete comment",
            error: error.message,
        });
    }
});

/* Get Ideas Created By Logged In User */
app.get("/my-ideas", async (req, res) => {
    try {
        const email = req.query.email;

        if (!email) {
            return res.status(400).send({
                success: false,
                message: "User email is required",
            });
        }

        const result = await ideasCollection
            .find({ creatorEmail: email })
            .sort({ createdAt: -1 })
            .toArray();

        res.send(result);
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to load my ideas",
            error: error.message,
        });
    }
});

/* Update Own Idea */
app.patch("/ideas/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const updatedIdea = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid idea id",
            });
        }

        const query = {
            _id: new ObjectId(id),
            creatorEmail: updatedIdea.creatorEmail,
        };

        const updateDoc = {
            $set: {
                ideaTitle: updatedIdea.ideaTitle,
                shortDescription: updatedIdea.shortDescription,
                detailedDescription: updatedIdea.detailedDescription,
                category: updatedIdea.category,
                tags: updatedIdea.tags || [],
                imageURL: updatedIdea.imageURL,
                estimatedBudget: updatedIdea.estimatedBudget || null,
                targetAudience: updatedIdea.targetAudience,
                problemStatement: updatedIdea.problemStatement,
                proposedSolution: updatedIdea.proposedSolution,
                updatedAt: new Date().toISOString(),
            },
        };

        const result = await ideasCollection.updateOne(query, updateDoc);

        res.send({
            success: result.modifiedCount > 0,
            message:
                result.modifiedCount > 0
                    ? "Idea updated successfully"
                    : "You can only update your own idea",
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to update idea",
            error: error.message,
        });
    }
});

/* Delete Own Idea */
app.delete("/ideas/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { creatorEmail } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid idea id",
            });
        }

        const result = await ideasCollection.deleteOne({
            _id: new ObjectId(id),
            creatorEmail,
        });

        if (result.deletedCount > 0) {
            await commentsCollection.deleteMany({ ideaId: id });
            await bookmarksCollection.deleteMany({ ideaId: id });
        }

        res.send({
            success: result.deletedCount > 0,
            message:
                result.deletedCount > 0
                    ? "Idea deleted successfully"
                    : "You can only delete your own idea",
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to delete idea",
            error: error.message,
        });
    }
});

/* My Interactions - Ideas Where User Commented */
app.get("/my-interactions", async (req, res) => {
    try {
        const email = req.query.email;

        if (!email) {
            return res.status(400).send({
                success: false,
                message: "User email is required",
            });
        }

        const comments = await commentsCollection
            .find({ userEmail: email })
            .sort({ createdAt: -1 })
            .toArray();

        if (comments.length === 0) {
            return res.send([]);
        }

        const uniqueIdeaIds = [
            ...new Set(comments.map((comment) => comment.ideaId).filter(Boolean)),
        ];

        const objectIds = uniqueIdeaIds
            .filter((id) => ObjectId.isValid(id))
            .map((id) => new ObjectId(id));

        if (objectIds.length === 0) {
            return res.send([]);
        }

        const ideas = await ideasCollection
            .find({ _id: { $in: objectIds } })
            .toArray();

        const result = ideas.map((idea) => {
            const relatedComments = comments.filter(
                (comment) => comment.ideaId === idea._id.toString()
            );

            return {
                ...idea,
                myComments: relatedComments,
            };
        });

        res.send(result);
    } catch (error) {
        console.error("My interactions error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to load my interactions",
            error: error.message,
        });
    }
});

/* Check Bookmark Status For One Idea */
app.get("/ideas/:id/bookmark-status", async (req, res) => {
    try {
        const ideaId = req.params.id;
        const email = req.query.email;

        if (!email) {
            return res.status(400).send({
                success: false,
                message: "User email is required",
            });
        }

        const bookmark = await bookmarksCollection.findOne({
            ideaId,
            userEmail: email,
        });

        const idea = await ideasCollection.findOne({
            _id: new ObjectId(ideaId),
        });

        res.send({
            success: true,
            bookmarked: Boolean(bookmark),
            bookmarksCount: idea?.bookmarksCount || 0,
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to check bookmark status",
            error: error.message,
        });
    }
});

/* Toggle Bookmark */
app.post("/ideas/:id/bookmark", async (req, res) => {
    try {
        const ideaId = req.params.id;
        const { userEmail, userName, userImage } = req.body;

        if (!userEmail) {
            return res.status(400).send({
                success: false,
                message: "User email is required",
            });
        }

        if (!ObjectId.isValid(ideaId)) {
            return res.status(400).send({
                success: false,
                message: "Invalid idea id",
            });
        }

        const existingBookmark = await bookmarksCollection.findOne({
            ideaId,
            userEmail,
        });

        if (existingBookmark) {
            await bookmarksCollection.deleteOne({
                _id: existingBookmark._id,
            });

            await ideasCollection.updateOne(
                {
                    _id: new ObjectId(ideaId),
                    bookmarksCount: { $gt: 0 },
                },
                {
                    $inc: { bookmarksCount: -1 },
                }
            );

            const updatedIdea = await ideasCollection.findOne({
                _id: new ObjectId(ideaId),
            });

            return res.send({
                success: true,
                bookmarked: false,
                message: "Bookmark removed",
                bookmarksCount: updatedIdea?.bookmarksCount || 0,
            });
        }

        const newBookmark = {
            ideaId,
            userEmail,
            userName: userName || "IdeaVault User",
            userImage: userImage || "",
            createdAt: new Date().toISOString(),
        };

        await bookmarksCollection.insertOne(newBookmark);

        await ideasCollection.updateOne(
            { _id: new ObjectId(ideaId) },
            { $inc: { bookmarksCount: 1 } }
        );

        const updatedIdea = await ideasCollection.findOne({
            _id: new ObjectId(ideaId),
        });

        res.send({
            success: true,
            bookmarked: true,
            message: "Idea bookmarked",
            bookmarksCount: updatedIdea?.bookmarksCount || 0,
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to toggle bookmark",
            error: error.message,
        });
    }
});

/* My Bookmarked Ideas */
app.get("/my-bookmarks", async (req, res) => {
    try {
        const email = req.query.email;

        if (!email) {
            return res.status(400).send({
                success: false,
                message: "User email is required",
            });
        }

        const bookmarks = await bookmarksCollection
            .find({ userEmail: email })
            .sort({ createdAt: -1 })
            .toArray();

        if (bookmarks.length === 0) {
            return res.send([]);
        }

        const ideaIds = bookmarks
            .map((bookmark) => bookmark.ideaId)
            .filter((id) => ObjectId.isValid(id))
            .map((id) => new ObjectId(id));

        const ideas = await ideasCollection
            .find({ _id: { $in: ideaIds } })
            .toArray();

        const result = bookmarks
            .map((bookmark) => {
                const idea = ideas.find(
                    (item) => item._id.toString() === bookmark.ideaId
                );

                if (!idea) return null;

                return {
                    ...idea,
                    bookmarkedAt: bookmark.createdAt,
                };
            })
            .filter(Boolean);

        res.send(result);
    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to load bookmarks",
            error: error.message,
        });
    }
});


async function run() {
    try {
        await client.connect();

        const database = client.db("startup-server");

        ideasCollection = database.collection("ideas");
        commentsCollection = database.collection("comments");
        bookmarksCollection = database.collection("bookmarks");

        await client.db("admin").command({ ping: 1 });

        console.log("Connected to MongoDB!");
    } catch (err) {
        console.error("MongoDB connection failed:", err);
        process.exit(1);
    }
}

run();

app.listen(PORT, () => {
    console.log(`Startup ideas server listening on port ${PORT}`);
});