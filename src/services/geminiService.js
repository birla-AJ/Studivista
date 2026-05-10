import {
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GEMINI_SYSTEM_PROMPT,
    GEMINI_TEACHER_SYSTEM_PROMPT,
} from '../config/geminiConfig';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const toGeminiContent = (message) => ({
    role: message.sender === 'ai' ? 'model' : 'user',
    parts: [{ text: message.text }],
});

export const askGemini = async ({ messages, question, role = 'student' }) => {
    const apiKey = GEMINI_API_KEY.trim();

    if (!apiKey) {
        throw new Error('Gemini API key is missing. Add it in src/config/geminiConfig.js.');
    }

    const systemPrompt = role === 'teacher' ? GEMINI_TEACHER_SYSTEM_PROMPT : GEMINI_SYSTEM_PROMPT;

    const history = messages
        .filter(message => message.sender === 'student' || message.sender === 'teacher' || message.sender === 'ai')
        .map(toGeminiContent);

    const response = await fetch(`${API_BASE}/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: [
                ...history,
                {
                    role: 'user',
                    parts: [{ text: question }],
                },
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 800,
            },
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        const message = data?.error?.message || 'Unable to reach Gemini right now.';
        throw new Error(message);
    }

    const answer = data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text)
        .filter(Boolean)
        .join('\n')
        .trim();

    if (!answer) {
        throw new Error('Gemini returned an empty answer. Please try again.');
    }

    return answer;
};
