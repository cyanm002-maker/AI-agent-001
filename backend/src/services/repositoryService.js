const {
    getInstallationOctokit,
    appOctokit
} = require("../config/githubApp");

const getRepositoryStructure = async (
    user,
    installationId,
    owner,
    repo
) => {
    // Verify GitHub account ownership
    const identity = user.identities?.find(
        (item) => item.provider === "github"
    );

    const githubUserId =
        identity?.provider_id ||
        identity?.id ||
        identity?.identity_data?.sub;

    if (!githubUserId) {
        throw new Error("GitHub identity not found");
    }

    const { data: installation } = await appOctokit.request(
        "GET /app/installations/{installation_id}",
        { installation_id: installationId }
    );

    if (String(installation.account.id) !== String(githubUserId)) {
        throw new Error("You do not own this GitHub installation");
    }

    if (installation.suspended_at) {
        throw new Error("GitHub App installation is suspended");
    }

    // Create an authenticated GitHub client
    const octokit = getInstallationOctokit(installationId);

    // Get repository information
    const { data: repository } = await octokit.rest.repos.get({
        owner,
        repo
    });

    // Get the default branch
    const { data: branch } = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: repository.default_branch
    });

    // Get the repository file tree
    const { data: tree } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: branch.commit.sha,
        recursive: "true"
    });

    const files = tree.tree
        .filter((item) => item.type === "blob")
        .slice(0, 100)
        .map((item) => ({
            path: item.path,
            size: item.size
        }));

    return {
        name: repository.full_name,
        defaultBranch: repository.default_branch,
        files,
        truncated: tree.truncated || tree.tree.length > 100
    };
};

const getRepositoryFileContents = async (
    installationId,
    owner,
    repo,
    paths
) => {
    const octokit = getInstallationOctokit(installationId);

    const selectedFiles = paths.slice(0, 5);
    const fileContents = [];

    for (const filePath of selectedFiles) {
        try {
            // Only accept normal relative repository paths
            if (
                typeof filePath !== "string" ||
                filePath.startsWith("/") ||
                filePath.includes("\\") ||
                filePath.split("/").some(
                    (part) => part === "." || part === ".." || !part
                )
            ) {
                continue;
            }

            const { data: file } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath
            });

            // Skip directories and files larger than 20 KB
            if (
                Array.isArray(file) ||
                file.type !== "file" ||
                file.size > 20000 ||
                file.encoding !== "base64"
            ) {
                continue;
            }

            const content = Buffer.from(
                file.content,
                "base64"
            ).toString("utf8");

            // Skip binary files
            if (content.includes("\0")) {
                continue;
            }

            fileContents.push({
                path: file.path,
                content
            });

        } catch (error) {
            console.error(
                `Could not read ${filePath}:`,
                error.message
            );
        }
    }

    return fileContents;
};
module.exports = {
    getRepositoryStructure,
    getRepositoryFileContents
};