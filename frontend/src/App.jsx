
import { useState } from "react";
import { supabase } from "./lib/supabase";

function App() {
    // Authentication states
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [message, setMessage] = useState("");

    // GitHub repository states
    const [installationId, setInstallationId] = useState("");
    const [repositories, setRepositories] = useState([]);

    // Repository explorer states
    const [owner, setOwner] = useState("");
    const [repoName, setRepoName] = useState("");

    const [repositoryInfo, setRepositoryInfo] = useState(null);
    const [files, setFiles] = useState([]);
    const [treeTruncated, setTreeTruncated] = useState(false);

    const [loading, setLoading] = useState(false);

    // 1. Login using GitHub
    const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "github",
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) {
            setMessage(error.message);
        }
    };

    // 2. Get logged-in user's session
    const handleGetUser = async () => {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            setMessage(error.message);
            return;
        }

        if (!data.session) {
            setMessage("Please sign in first.");
            return;
        }

        setUser(data.session.user);
        setMessage("User session found!");
    };

    // 3. Test protected Express profile API
    const handleTestProfile = async () => {
        try {
            const { data, error } = await supabase.auth.getSession();

            if (error || !data.session) {
                setMessage("Please sign in first.");
                return;
            }

            const accessToken = data.session.access_token;

            const response = await fetch(
                "http://localhost:5000/api/profile",
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                }
            );

            const result = await response.json();

            if (!response.ok) {
                setMessage(result.message || "API request failed");
                return;
            }

            setProfile(result);
            setMessage("Protected API accessed successfully!");

        } catch (error) {
            setMessage(error.message);
        }
    };

    // 4. Logout
    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            setMessage(error.message);
            return;
        }

        setUser(null);
        setProfile(null);
        setRepositories([]);
        setRepositoryInfo(null);
        setFiles([]);
        setTreeTruncated(false);

        setMessage("Logged out successfully.");
    };

    // 5. Fetch GitHub repositories
    const handleGetRepositories = async () => {
        try {
            if (!installationId.trim()) {
                setMessage("Please enter your GitHub installation ID.");
                return;
            }

            const { data, error } = await supabase.auth.getSession();

            if (error || !data.session) {
                setMessage("Please sign in first.");
                return;
            }

            const response = await fetch(
                "http://localhost:5000/api/github/installation/repositories",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.session.access_token}`
                    },
                    body: JSON.stringify({
                        installation_id: installationId
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                setMessage(result.message || "Failed to fetch repositories");
                return;
            }

            setRepositories(result.repositories || []);
            setMessage("GitHub repositories loaded successfully!");

        } catch (error) {
            setMessage(error.message);
        }
    };

    // 6. Explore repository and fetch file tree
    const handleExploreRepository = async () => {
        try {
            if (
                !installationId.trim() ||
                !owner.trim() ||
                !repoName.trim()
            ) {
                setMessage("Please enter all repository details.");
                return;
            }

            setLoading(true);
            setMessage("");

            const { data, error } = await supabase.auth.getSession();

            if (error || !data.session) {
                setMessage("Please sign in first.");
                return;
            }

            const response = await fetch(
                "http://localhost:5000/api/repositories/tree",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.session.access_token}`
                    },
                    body: JSON.stringify({
                        installation_id: installationId,
                        owner: owner.trim(),
                        repo: repoName.trim()
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                setMessage(
                    result.message || "Unable to explore repository."
                );
                return;
            }

            setRepositoryInfo(result.repository);
            setFiles(result.files || []);
            setTreeTruncated(result.truncated || false);

            setMessage("Repository explored successfully!");

        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                padding: "40px",
                fontFamily: "Arial, sans-serif",
                maxWidth: "1000px",
                margin: "auto"
            }}
        >

            <h1>RepoPilot</h1>
            <p>AI-powered GitHub Issue Solver</p>

            <hr />

            {/* Authentication */}
            <h2>Authentication</h2>

            <button onClick={handleLogin}>
                Sign in with GitHub
            </button>

            <button
                onClick={handleGetUser}
                style={{ marginLeft: "10px" }}
            >
                Get User Session
            </button>

            <button
                onClick={handleTestProfile}
                style={{ marginLeft: "10px" }}
            >
                Test Protected API
            </button>

            <button
                onClick={handleLogout}
                style={{ marginLeft: "10px" }}
            >
                Logout
            </button>

            {/* Status Message */}
            <p>{message}</p>

            {/* Logged-in User */}
            {user && (
                <div>
                    <h2>Logged-in User</h2>
                    <p>Email: {user.email}</p>
                    <p>User ID: {user.id}</p>
                </div>
            )}

            {/* Backend Profile */}
            {profile && (
                <div>
                    <h2>Backend Profile Response</h2>
                    <pre>
                        {JSON.stringify(profile, null, 2)}
                    </pre>
                </div>
            )}

            <hr />

            {/* GitHub Repository Access */}
            <h2>GitHub Repository Access</h2>

            <p>
                Enter the installation ID of your GitHub App.
            </p>

            <input
                type="text"
                placeholder="Enter installation ID"
                value={installationId}
                onChange={(e) => setInstallationId(e.target.value)}
            />

            <button
                onClick={handleGetRepositories}
                style={{ marginLeft: "10px" }}
            >
                Load Repositories
            </button>

            {/* Repository List */}
            <div>
                <h2>Accessible Repositories</h2>

                {repositories.length === 0 ? (
                    <p>No repositories loaded yet.</p>
                ) : (
                    repositories.map((repo) => (
                        <div
                            key={repo.id}
                            style={{
                                border: "1px solid #ccc",
                                padding: "15px",
                                marginBottom: "10px",
                                borderRadius: "8px"
                            }}
                        >
                            <h3>{repo.full_name}</h3>

                            <p>
                                {repo.private
                                    ? "Private Repository"
                                    : "Public Repository"}
                            </p>

                            <p>
                                Default Branch: {repo.default_branch}
                            </p>

                            <a
                                href={repo.html_url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                View Repository
                            </a>

                            <button
                                onClick={() => {
                                    setOwner(repo.owner.login);
                                    setRepoName(repo.name);
                                    setMessage(
                                        "Repository selected. Click Explore Repository."
                                    );
                                }}
                                style={{ marginLeft: "10px" }}
                            >
                                Select Repository
                            </button>
                        </div>
                    ))
                )}
            </div>

            <hr />

            {/* Repository Explorer */}
            <h2>Repository Explorer</h2>

            <p>
                Select a repository above or enter its details manually.
            </p>

            <div style={{ marginBottom: "15px" }}>
                <input
                    type="text"
                    placeholder="GitHub username / owner"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                />

                <input
                    type="text"
                    placeholder="Repository name"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    style={{ marginLeft: "10px" }}
                />

                <button
                    onClick={handleExploreRepository}
                    disabled={loading}
                    style={{ marginLeft: "10px" }}
                >
                    {loading ? "Exploring..." : "Explore Repository"}
                </button>
            </div>

            {/* Repository Information */}
            {repositoryInfo && (
                <div
                    style={{
                        border: "1px solid #ccc",
                        padding: "15px",
                        borderRadius: "8px",
                        marginBottom: "20px"
                    }}
                >
                    <h3>{repositoryInfo.full_name}</h3>

                    <p>
                        Default Branch: {repositoryInfo.default_branch}
                    </p>

                    <p>
                        Visibility: {repositoryInfo.private
                            ? "Private"
                            : "Public"}
                    </p>

                    <p>
                        Total Items: {files.length}
                    </p>

                    {treeTruncated && (
                        <p style={{ color: "orange" }}>
                            Warning: GitHub returned a truncated file tree.
                            Not all repository items may be displayed.
                        </p>
                    )}
                </div>
            )}

            {/* Repository File Tree */}
            {repositoryInfo && (
                <div>
                    <h3>Repository Files</h3>

                    {files.length === 0 ? (
                        <p>No files found.</p>
                    ) : (
                        files.map((file) => {
                            const depth = file.path.split("/").length - 1;

                            return (
                                <div
                                    key={file.path}
                                    style={{
                                        paddingLeft: `${depth * 25}px`,
                                        paddingTop: "6px",
                                        paddingBottom: "6px",
                                        borderBottom: "1px solid #eee"
                                    }}
                                >
                                    {file.type === "tree" ? "📁" : "📄"}
                                    {" "}
                                    {file.path.split("/").pop()}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

        </div>
    );
}

export default App;
