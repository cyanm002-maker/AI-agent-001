const { createTwoFilesPatch } = require("diff");

const generateDiff = (sourceCode, proposedChanges) => {
    const diffs = [];

    for (const change of proposedChanges) {
        const originalFile = sourceCode.find(
            (file) => file.path === change.path
        );

        if (!originalFile) {
            throw new Error(
                `Original file not found: ${change.path}`
            );
        }

        const patch = createTwoFilesPatch(
            change.path,
            change.path,
            originalFile.content,
            change.updatedContent,
            "Original",
            "RepoPilot Proposed"
        );

        diffs.push({
            path: change.path,
            explanation: change.explanation,
            patch
        });
    }

    return diffs;
};

module.exports = { generateDiff };