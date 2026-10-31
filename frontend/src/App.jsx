
import { signInWithGithub } from "./services/authService";

function App() {

    const handleGithubLogin = async () => {
        try {
            await signInWithGithub();
        } catch (error) {
            console.error("Login failed:", error.message);
        }
    };

    return (
        <div>
            <h1>Welcome to RepoPilot</h1>

            <button onClick={handleGithubLogin}>
                Continue with GitHub
            </button>
        </div>
    );
}

export default App;
