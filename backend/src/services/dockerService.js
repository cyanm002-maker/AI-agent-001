
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

const runDockerTests = async (workspacePath) => {
    const packagePath = path.join(workspacePath, "package.json");

    // Check whether package.json exists
    try {
        await fs.access(packagePath);
    } catch {
        throw new Error("package.json not found. Only Node.js projects are supported.");
    }

    // Read package.json
    const packageData = JSON.parse(
        await fs.readFile(packagePath, "utf8")
    );

    if (!packageData.scripts || !packageData.scripts.test) {
        return {
            success: false,
            output: "No test script found in package.json."
        };
    }

    return new Promise((resolve) => {
        let output = "";
        let finished = false;

        const finish = (result) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            resolve(result);
        };

        // Install dependencies in an isolated container.
        // Install scripts are disabled to reduce risk.
        const install = spawn("docker", [
            "run",
            "--rm",
            "--memory=512m",
            "--cpus=1",
            "--pids-limit=128",
            "--network=bridge",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--mount",
            `type=bind,source=${workspacePath},target=/workspace`,
            "--workdir=/workspace",
            "node:22-alpine",
            "npm",
            "ci",
            "--ignore-scripts"
        ], {
            windowsHide: true
        });

        const timeout = setTimeout(() => {
            install.kill();
            finish({
                success: false,
                output: "Dependency installation timed out."
            });
        }, 120000);

        install.stdout.on("data", (data) => {
            output += data.toString();
        });

        install.stderr.on("data", (data) => {
            output += data.toString();
        });

        install.on("error", (error) => {
            finish({
                success: false,
                output: `Docker error: ${error.message}`
            });
        });

        install.on("close", async (code) => {
            if (finished) return;

            if (code !== 0) {
                return finish({
                    success: false,
                    output: output.slice(-10000)
                });
            }

            // Run tests with networking disabled.
            const test = spawn("docker", [
                "run",
                "--rm",
                "--memory=512m",
                "--cpus=1",
                "--pids-limit=128",
                "--network=none",
                "--cap-drop=ALL",
                "--security-opt=no-new-privileges",
                "--mount",
                `type=bind,source=${workspacePath},target=/workspace,readonly`,
                "--workdir=/workspace",
                "node:22-alpine",
                "sh",
                "-lc",
                "npm test"
            ], {
                windowsHide: true
            });

            test.stdout.on("data", (data) => {
                output += data.toString();
            });

            test.stderr.on("data", (data) => {
                output += data.toString();
            });

            test.on("error", (error) => {
                finish({
                    success: false,
                    output: `Docker test error: ${error.message}`
                });
            });

            test.on("close", (testCode) => {
                finish({
                    success: testCode === 0,
                    output: output.slice(-10000)
                });
            });
        });
    });
};

module.exports = { runDockerTests };
