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

// --------------------------------------------------------------------------------------------------------------------------------------------------


// Fetch the contents of an individual repository file
router.post("/file", authMiddleware, async (req, res) => {
    try {
        const { installation_id, owner, repo, path: filePath } = req.body;

        const installationId = Number(installation_id);

        // 1. Validate request data
        if (
            !Number.isSafeInteger(installationId) ||
            installationId <= 0 ||
            typeof owner !== "string" ||
            typeof repo !== "string" ||
            typeof filePath !== "string" ||
            !/^[a-zA-Z0-9_.-]+$/.test(owner) ||
            !/^[a-zA-Z0-9_.-]+$/.test(repo) ||
            !filePath.trim() ||
            filePath.startsWith("/") ||
            filePath.includes("\\") ||
            filePath.includes("\0") ||
            filePath.split("/").some(
                part => part === "." || part === ".." || part === ""
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid repository or file details"
            });
        }

        // 2. Get the authenticated user's GitHub identity
        const githubIdentity = req.user.identities?.find(
            identity => identity.provider === "github"
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

        // 3. Verify that the installation belongs to this user
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

        // 5. Fetch the requested file from GitHub
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath
        });

        const file = response.data;

        // 6. Make sure the requested path is a file
        if (Array.isArray(file) || file.type !== "file") {
            return res.status(400).json({
                success: false,
                message: "The requested path is not a regular file"
            });
        }

        // 7. Limit file size for our first version
        if (file.size > 1000000) {
            return res.status(413).json({
                success: false,
                message: "File is too large. Maximum supported size is 1 MB."
            });
        }

        if (!file.content || file.encoding !== "base64") {
            return res.status(422).json({
                success: false,
                message: "GitHub did not return readable file content"
            });
        }

        // 8. Decode Base64 content into readable text
        const fileBuffer = Buffer.from(file.content, "base64");

        // Basic check to avoid displaying binary files
        if (fileBuffer.includes(0)) {
            return res.status(415).json({
                success: false,
                message: "Binary files are not supported yet"
            });
        }

        const content = fileBuffer.toString("utf8");

        // 9. Send file information to React
        return res.status(200).json({
            success: true,
            file: {
                name: file.name,
                path: file.path,
                size: file.size,
                content
            }
        });

    } catch (error) {
        console.error(
            "File reading error:",
            error.status,
            error.message
        );

        const status = [401, 403, 404, 409, 422].includes(error.status)
            ? error.status
            : 500;

        return res.status(status).json({
            success: false,
            message: status === 404
                ? "File or repository not found, or access denied"
                : "Unable to read repository file"
        });
    }
});


module.exports = router;