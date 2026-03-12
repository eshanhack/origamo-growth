import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { url, brandName } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { found: false, prominence: "Unknown", summary: "ANTHROPIC_API_KEY not configured", games_found: [], position: "N/A" },
      { status: 200 }
    );
  }

  try {
    const prompt = `Visit ${url} and search for any casino games by 'Origami' or 'betorigami' or any of these game titles: [Plinko, Mines, Dice, Crash, Keno, Wheel, Tower, Limbo, Hilo]. Report back: (1) Are Origami games visible on the homepage or main lobby? (2) What position/section are they in? (3) List any specific Origami game titles found. (4) Are they featured/promoted or buried? Return a JSON object with fields: found (boolean), position (string), games_found (array of strings), prominence (one of "Featured", "Visible", "Buried", "Not Found"), summary (string). Return ONLY the JSON, no other text.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { found: false, prominence: "Unknown", summary: `API error: ${response.status}`, games_found: [], position: "N/A" },
        { status: 200 }
      );
    }

    const data = await response.json();

    // Extract text from the response
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    const text = textBlock?.text || "";

    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          found: parsed.found ?? false,
          prominence: parsed.prominence || "Unknown",
          summary: parsed.summary || "Scan complete",
          games_found: parsed.games_found || [],
          position: parsed.position || "N/A",
        });
      } catch {
        // JSON parse failed
      }
    }

    return NextResponse.json({
      found: false,
      prominence: "Unknown",
      summary: text.slice(0, 200) || "Could not parse scan results",
      games_found: [],
      position: "N/A",
    });
  } catch (err) {
    return NextResponse.json(
      { found: false, prominence: "Unknown", summary: "Scan failed — network error", games_found: [], position: "N/A" },
      { status: 200 }
    );
  }
}
