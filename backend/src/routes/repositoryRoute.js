const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    appOctokit,
    getInstallationOctokit
} = require("../config/githubApp");

const router = express.Router();

// Fetch repository information and its complete file tree
router.post("/tree", authMiddleware, async (req, res) => {
    try {
        const { installation_id, owner, repo } = req.body;

        // 1. Validate input
        const installationId = Number(installation_id);

        if (
            !Number.isSafeInteger(installationId) ||
            installationId <= 0 ||
            typeof owner !== "string" ||
            typeof repo !== "string" ||
            !/^[a-zA-Z0-9_.-]+$/.test(owner) ||
            !/^[a-zA-Z0-9_.-]+$/.test(repo)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid installation ID, owner, or repository"
            });
        }

        // 2. Get the authenticated user's GitHub identity
        const githubIdentity = req.user.identities?.find(
            (identity) => identity.provider === "github"
        );

        const githubAccountId =
            githubIdentity?.provider_id ||
            githubIdentity?.id ||
            githubIdentity?.identity_data?.sub;

        if (!githubAccountId) {
            return res.status(403).json({
                success: false,
                message: "GitHub identity not found"
            });
        }

        // 3. Verify the installation belongs to this GitHub account
        const { data: installation } = await appOctokit.request(
            "GET /app/installations/{installation_id}",
            {
                installation_id: installationId
            }
        );

        if (
            String(installation.account.id) !==
            String(githubAccountId)
        ) {
            return res.status(403).json({
                success: false,
                message: "You do not own this installation"
            });
        }

        if (installation.suspended_at) {
            return res.status(403).json({
                success: false,
                message: "GitHub App installation is suspended"
            });
        }

        // 4. Create an installation-authenticated GitHub client
        const octokit = getInstallationOctokit(installationId);

        // 5. Check that this repository is accessible
        const repositoryResponse = await octokit.rest.repos.get({
            owner,
            repo
        });

        const repository = repositoryResponse.data;

        // 6. Get the latest commit from the default branch
        const branchResponse = await octokit.rest.repos.getBranch({
            owner,
            repo,
            branch: repository.default_branch
        });

        // 7. Get the commit's tree SHA
        const commitResponse = await octokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha: branchResponse.data.commit.sha
        });

        // 8. Fetch the complete repository tree
        const treeResponse = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: commitResponse.data.tree.sha,
            recursive: "1"
        });

        // 9. Prepare the response
        const files = treeResponse.data.tree.map((item) => ({
            path: item.path,
            type: item.type,
            size: item.size || 0,
            sha: item.sha
        }));

        return res.status(200).json({
            success: true,
            repository: {
                name: repository.name,
                full_name: repository.full_name,
                default_branch: repository.default_branch,
                private: repository.private
            },
            total_items: files.length,
            truncated: treeResponse.data.truncated,
            files
        });

    } catch (error) {
        console.error(
            "Repository explorer error:",
            error.status,
            error.message
        );

        const status = [401, 403, 404, 409, 422].includes(error.status)
            ? error.status
            : 500;

        return res.status(status).json({
            success: false,
            message: status === 404
                ? "Repository or installation not found, or repository is inaccessible"
                : "Unable to explore repository"
        });
    }
});

module.exports = router;