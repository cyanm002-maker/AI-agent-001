const generateResponse = async (prompt) => {
    try {
        const response = await fetch(
            `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "X-Title": "RepoPilot"
                },
                body: JSON.stringify({
                    model: process.env.OPENROUTER_MODEL,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error?.message || "OpenRouter API request failed"
            );
        }

        return data.choices[0].message.content;

    } catch (error) {
        console.error("AI Service Error:", error.message);
        throw error;
    }
};

module.exports = { generateResponse };