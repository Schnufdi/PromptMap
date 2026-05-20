module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { seedIdea, parentLabel, parentDimension, mapContext, isRoot, extra } = req.body || {};
    if (!seedIdea) return res.status(400).json({ error: 'seedIdea required' });

    const prompt = isRoot
        ? buildRootPrompt(seedIdea)
        : buildBranchPrompt(seedIdea, parentLabel, parentDimension, mapContext, extra);

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 800,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(502).json({ error: 'Claude API error', detail: errText });
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '[]';

        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        let branches = [];
        if (jsonMatch) {
            try { branches = JSON.parse(jsonMatch[0]); } catch (e) { branches = []; }
        }

        return res.json({ branches });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

function buildRootPrompt(seedIdea) {
    return `You are a sharp business strategist, product thinker, and commercial operator. Someone has an idea: "${seedIdea}"

Generate exactly 6 structural dimensions to explore. Cover the critical angles anyone building this needs to think through. Make every label and description SPECIFIC to this idea — not generic startup advice.

Cover these angles (in your own words, specific to the idea):
1. The core problem or opportunity this addresses
2. The specific target user — their situation, pain, and motivation
3. How money actually flows — the business model
4. How you reach and acquire users at scale
5. What makes this defensible — moat or differentiation
6. The critical risk — what most likely kills or limits this

Return ONLY valid JSON array, no other text:
[
  {"label": "5-8 word specific label", "description": "one punchy sentence specific to this idea", "dimension": "Problem"},
  {"label": "...", "description": "...", "dimension": "Target User"},
  {"label": "...", "description": "...", "dimension": "Business Model"},
  {"label": "...", "description": "...", "dimension": "Distribution"},
  {"label": "...", "description": "...", "dimension": "Moat"},
  {"label": "...", "description": "...", "dimension": "Risk"}
]`;
}

function buildBranchPrompt(seedIdea, parentLabel, parentDimension, mapContext, extra) {
    const focus = extra
        ? `\n\nIMPORTANT: ${extra}`
        : '';

    return `You are a sharp business strategist. The core idea is: "${seedIdea}"

What's been explored so far:
${mapContext || 'Just starting — only the seed idea exists.'}

The user wants to explore deeper into: "${parentLabel}"${parentDimension ? ` (${parentDimension})` : ''}${focus}

Generate exactly 5 specific, insightful branch directions from this node. Rules:
- Concrete and specific to THIS idea and context — never generic
- Mix of expected and at least 1-2 unexpected or contrarian angles
- Informed by what's already on the map (don't repeat what's there)
- Each should spark a genuine "hm, that's interesting" reaction

Return ONLY valid JSON array, no other text:
[
  {"label": "5-8 word specific label", "description": "one punchy sentence"},
  {"label": "...", "description": "..."},
  {"label": "...", "description": "..."},
  {"label": "...", "description": "..."},
  {"label": "...", "description": "..."}
]`;
}
