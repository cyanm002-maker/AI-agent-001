const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { runAgent } = require("../services/agentGraph");
const { runRepositoryAgent } = require("../services/agentGraph");

// POST /api/ai/chat
router.post("/chat", authMiddleware, async (req, res) => {
    try {
        const { prompt } = req.body;

        // Validate prompt
        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid prompt."
            });
        }

        if (prompt.length > 10000) {
            return res.status(400).json({
                success: false,
                message: "Prompt cannot exceed 10,000 characters."
            });
        }

        // Send prompt to DeepSeek R1
        const aiResponse = await runAgent(prompt);

        return res.status(200).json({
            success: true,
            response: aiResponse
        });

    } catch (error) {
        console.error("AI Route Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to generate AI response."
        });
    }
});

router.post("/analyze-issue", authMiddleware, async (req, res) => {
    try {
        const {
            installation_id,
            owner,
            repo,
            issue
        } = req.body;

        if (
            !Number.isSafeInteger(Number(installation_id)) ||
            !owner ||
            !repo ||
            !issue ||
            typeof issue !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid repository or issue details."
            });
        }

        if (
            !/^[a-zA-Z0-9-]+$/.test(owner) ||
            !/^[a-zA-Z0-9._-]+$/.test(repo) ||
            issue.length > 5000
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid input."
            });
        }

        const result = await runRepositoryAgent({
            user: req.user,
            installationId: Number(installation_id),
            owner,
            repo,
            issue
        });

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error("Repository Agent Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to analyze repository issue."
        });
    }
});

module.exports = router;