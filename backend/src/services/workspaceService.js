const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const simpleGit = require("simple-git");

const { appOctokit } = require("../config/githubApp");

// Create a temporary Git workspace
const createWorkspace = async (
    installationId,
    owner,
    repo
) => {
    let workspacePath;

    try {
        // Generate a short-lived installation token
        const { data } = await appOctokit.request(
            "POST /app/installations/{installation_id}/access_tokens",
            {
                installation_id: installationId
            }
        );

        const accessToken = data.token;

        // Create a unique temporary directory
        workspacePath = await fs.mkdtemp(
            path.join(os.tmpdir(), "repopilot-")
        );

        // Configure Git authentication through environment variables.
        // The token is not embedded in the repository URL.
        const authHeader = Buffer.from(
            `x-access-token:${accessToken}`
        ).toString("base64");

        const git = simpleGit()
            .env("GIT_CONFIG_COUNT", "1")
            .env("GIT_CONFIG_KEY_0", "http.extraheader")
            .env(
                "GIT_CONFIG_VALUE_0",
                `AUTHORIZATION: basic ${authHeader}`
            )
            .env("GIT_TERMINAL_PROMPT", "0");

        const repositoryUrl =
            `https://github.com/${owner}/${repo}.git`;

        // Clone only the latest commit to reduce download size
        await git.clone(
            repositoryUrl,
            workspacePath,
            ["--depth", "1"]
        );

        return workspacePath;

    } catch (error) {
        // Remove incomplete workspace if cloning fails
        if (workspacePath) {
            await fs.rm(workspacePath, {
                recursive: true,
                force: true
            });
        }

        throw new Error(
            `Workspace creation failed: ${error.message}`
        );
    }
};

// Apply AI-proposed changes to the temporary workspace
const applyProposedChanges = async (
    workspacePath,
    proposedChanges
) => {
    for (const change of proposedChanges) {
        const filePath = change.path;

        if (
            typeof filePath !== "string" ||
            path.isAbsolute(filePath) ||
            filePath.includes("\\") ||
            filePath.split("/").some(
                (part) => !part || part === "." || part === ".."
            )
        ) {
            throw new Error("Invalid file path");
        }

        const fullPath = path.resolve(
            workspacePath,
            filePath
        );

        // Prevent path traversal outside the workspace
        const relativePath = path.relative(
            workspacePath,
            fullPath
        );

        if (
            relativePath.startsWith("..") ||
            path.isAbsolute(relativePath)
        ) {
            throw new Error("File path is outside workspace");
        }

        // Ensure the file already exists inside the cloned repository
        const stats = await fs.lstat(fullPath);

        if (!stats.isFile() || stats.isSymbolicLink()) {
            throw new Error(
                `Not a regular file: ${filePath}`
            );
        }

        if (
            typeof change.updatedContent !== "string" ||
            Buffer.byteLength(change.updatedContent, "utf8") > 50000
        ) {
            throw new Error("Invalid or oversized file content");
        }

        await fs.writeFile(
            fullPath,
            change.updatedContent,
            "utf8"
        );
    }

    return true;
};

// Delete temporary workspace
const removeWorkspace = async (workspacePath) => {
    await fs.rm(workspacePath, {
        recursive: true,
        force: true
    });
};

module.exports = {
    createWorkspace,
    applyProposedChanges,
    removeWorkspace
};