const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { runAgent } = require("../services/agentGraph");
const { runRepositoryAgent } = require("../services/agentGraph");

const {
    createWorkspace,
    applyProposedChanges,
    removeWorkspace
} = require("../services/workspaceService");

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

router.post("/prepare-workspace", authMiddleware, async (req, res) => {
    let workspacePath;

    try {
        const {
            installation_id,
            owner,
            repo,
            proposedChanges
        } = req.body;

        if (
            !Number.isSafeInteger(installation_id) ||
            !owner ||
            !repo ||
            !Array.isArray(proposedChanges)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid workspace details."
            });
        }

        if (
            !/^[a-zA-Z0-9-]+$/.test(owner) ||
            !/^[a-zA-Z0-9._-]+$/.test(repo) ||
            proposedChanges.length > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid repository or changes."
            });
        }

        // Create temporary repository copy
        workspacePath = await createWorkspace(
            installation_id,
            owner,
            repo
        );

        // Apply AI-generated changes
        await applyProposedChanges(
            workspacePath,
            proposedChanges
        );

        return res.status(200).json({
            success: true,
            message: "Workspace prepared successfully.",
            changedFiles: proposedChanges.map(
                (change) => change.path
            )
        });

    } catch (error) {
        console.error("Workspace Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to prepare workspace."
        });

    } finally {
        if (workspacePath) {
            try {
                await removeWorkspace(workspacePath);
            } catch (cleanupError) {
                console.error(
                    "Workspace cleanup failed:",
                    cleanupError.message
                );
            }
        }
    }
});

module.exports = router;