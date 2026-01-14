/**
 * Gemini Vision helper for receipt analysis
 * Simplified and robust version for Expo Snack
 */
export async function analyzeReceipt({ apiKey, base64 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `You are a receipt scanner. Look at this receipt image and extract the data.

RESPOND WITH ONLY THIS JSON FORMAT (no other text):
{"merchant":"STORE NAME HERE","category":"Food","date":"2024-01-01","currency":"INR","total_amount":100,"payment_method":"Card"}

EXTRACTION RULES:
1. merchant = Name of store/shop/restaurant (top of receipt usually)
2. category = Pick ONE: Food, Travel, Bills, Shopping, Health, Entertainment, Others
3. date = Date on receipt in YYYY-MM-DD format
4. currency = INR if you see ₹ or Rs, USD if $, EUR if €
5. total_amount = The FINAL TOTAL amount paid (look for "Total", "Grand Total", "Amount", "Net Amount") - JUST THE NUMBER, no currency symbol
6. payment_method = Cash, Card, or UPI

IMPORTANT: 
- total_amount MUST be a number like 150 or 299.50, NOT a string
- Look carefully for the biggest/final amount at bottom of receipt
- If you see ₹150 or Rs.150 or Rs 150, return 150 as total_amount

Return ONLY the JSON, nothing else:`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      }),
    });

    const data = await response.json();

    // Log for debugging
    console.log("Gemini Response:", JSON.stringify(data, null, 2));

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Raw Text:", rawText);

    // Clean and parse JSON
    let cleanText = rawText
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/gi, "")
      .replace(/^\s+|\s+$/g, "");

    const match = cleanText.match(/\{[\s\S]*\}/);

    if (!match) {
      console.log("No JSON found in response");
      return getDefault();
    }

    const parsed = JSON.parse(match[0]);
    console.log("Parsed:", parsed);

    // Extract amount - try multiple fields
    let amount = 0;
    if (typeof parsed.total_amount === "number") {
      amount = parsed.total_amount;
    } else if (typeof parsed.total_amount === "string") {
      // Remove currency symbols and parse
      amount = parseFloat(parsed.total_amount.replace(/[₹$€£,\s]/g, "")) || 0;
    } else if (parsed.amount) {
      amount = typeof parsed.amount === "number" ? parsed.amount : parseFloat(String(parsed.amount).replace(/[₹$€£,\s]/g, "")) || 0;
    } else if (parsed.total) {
      amount = typeof parsed.total === "number" ? parsed.total : parseFloat(String(parsed.total).replace(/[₹$€£,\s]/g, "")) || 0;
    }

    return {
      merchant: parsed.merchant || parsed.store || parsed.name || "Unknown Store",
      category: validateCategory(parsed.category),
      date: parsed.date || new Date().toISOString().slice(0, 10),
      currency: parsed.currency || "INR",
      total_amount: amount,
      payment_method: parsed.payment_method || parsed.payment || "Card",
    };
  } catch (err) {
    console.log("Gemini error:", err);
    return getDefault();
  }
}

function validateCategory(cat) {
  const valid = ["Food", "Travel", "Bills", "Shopping", "Health", "Entertainment", "Others"];
  if (!cat) return "Others";

  const normalized = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  return valid.includes(normalized) ? normalized : "Others";
}

function getDefault() {
  return {
    merchant: "Unknown Store",
    category: "Others",
    date: new Date().toISOString().slice(0, 10),
    currency: "INR",
    total_amount: 0,
    payment_method: "Card",
  };
}
