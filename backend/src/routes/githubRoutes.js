const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    appOctokit,
    getInstallationOctokit
} = require("../config/githubApp");

const router = express.Router();

router.post(
    "/installation/repositories",
    authMiddleware,
    async (req, res) => {
        try {
            const installationId = Number(req.body.installation_id);

            if (!Number.isSafeInteger(installationId) || installationId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid installation ID is required"
                });
            }

            // Find the GitHub identity linked to this Supabase user
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
                    message: "GitHub identity not found for this user"
                });
            }

            // Verify the installation using our own GitHub App credentials
            const { data: installation } = await appOctokit.request(
                "GET /app/installations/{installation_id}",
                {
                    installation_id: installationId
                }
            );

            // Verify that the installation belongs to the logged-in GitHub account
            if (
                String(installation.account.id) !==
                String(githubAccountId)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You do not own this GitHub App installation"
                });
            }

            if (installation.suspended_at) {
                return res.status(403).json({
                    success: false,
                    message: "This GitHub App installation is suspended"
                });
            }

            // Authenticate as the verified installation
            const installationOctokit =
                getInstallationOctokit(installationId);

            // Retrieve repositories available to this installation
            const { data } = await installationOctokit.request(
                "GET /installation/repositories"
            );

            const repositories = data.repositories.map((repo) => ({
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                private: repo.private,
                default_branch: repo.default_branch,
                html_url: repo.html_url
            }));

            return res.status(200).json({
                success: true,
                account: installation.account.login,
                total_count: repositories.length,
                repositories
            });

        } catch (error) {
            console.error(
                "GitHub repository error:",
                error.status,
                error.message
            );

            return res.status(error.status === 404 ? 404 : 500).json({
                success: false,
                message: "Unable to access GitHub repositories"
            });
        }
    }
);

module.exports = router;