const fs = require("fs");
const path = require("path");

const { Octokit } = require("@octokit/rest");
const { createAppAuth } = require("@octokit/auth-app");

const appId = process.env.GITHUB_APP_ID;

const privateKeyPath = path.resolve(
    process.cwd(),
    process.env.GITHUB_PRIVATE_KEY_PATH
);

if (!appId || !process.env.GITHUB_PRIVATE_KEY_PATH) {
    throw new Error("GitHub App environment variables are missing");
}

const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// Authenticates as the GitHub App itself
const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
        appId,
        privateKey
    }
});

// Creates a client for a particular installation
const getInstallationOctokit = (installationId) => {
    return new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId,
            privateKey,
            installationId
        }
    });
};

module.exports = {
    appOctokit,
    getInstallationOctokit
};