module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { seedIdea, parentLabel, mapContext, isRoot, extra } = req.body || {};
    if (!seedIdea) return res.status(400).json({ error: 'seedIdea required' });

    const prompt = isRoot
        ? buildRootPrompt(seedIdea)
        : buildBranchPrompt(seedIdea, parentLabel, mapContext, extra);

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
    return `Someone is building out this idea: "${seedIdea}"

Help them figure out what it actually is. Generate 5-6 key things they need to decide to properly define and build this proposition.

These are DESIGN DECISIONS — not business analysis or risk assessment. Think about:
- What the experience actually feels like for the person using it
- Who specifically it is for (their situation, not just a demographic)
- What the core mechanic or interaction is
- What it delivers — the real value someone gets
- What makes it unmistakably this, not a generic version
- What brings someone back (the retention hook, not as a risk but as a design choice)

Make every label SPECIFIC to "${seedIdea}". These should feel like things a thoughtful founder or product designer would actually sit down and work through.

Return ONLY valid JSON array, no other text:
[
  {"label": "5-8 word specific label", "description": "one sentence on why this is worth figuring out"},
  ...
]`;
}

function buildBranchPrompt(seedIdea, parentLabel, mapContext, extra) {
    const focusNote = extra ? `\n\nAngle to explore: ${extra}` : '';

    return `Someone is building: "${seedIdea}"

What's been decided or explored so far:
${mapContext || 'Just starting out.'}

They're now figuring out: "${parentLabel}"

Generate 5 specific OPTIONS for what this could be. These are buildable directions — concrete choices a designer or founder would actually consider and debate.

Rules:
- Specific to THIS idea (no generic phrases like "user-friendly interface" or "scalable platform")
- About BUILDING the thing, not analyzing it — no risks, no market sizing
- At least one unexpected or non-obvious direction
- Each option should be a real creative or product decision, not a category or framework
- Brief, punchy labels — like a founder pitching an approach${focusNote}

Return ONLY valid JSON array, no other text:
[
  {"label": "5-8 word specific option", "description": "one sentence on what this actually means"},
  ...
]`;
}
