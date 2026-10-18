import type { Category, CategoryPrediction } from "@/types";
import type { CategorizationService } from "@/services/categorizationService";
import { delay } from "@/services/apiClient";

const RULES: [RegExp, Category][] = [
  [/salary|neft cr|refund|dividend|payout|interest credit/i, "Income"],
  [/zepto|bigbasket|blinkit|dmart|kirana|fresh|grocer|supermarket/i, "Groceries"],
  [/swiggy|zomato|domino|pizza|starbucks|cafe|restaurant|haldiram|truffles/i, "Dining"],
  [/uber|ola|rapido|irctc|metro|petrol|fuel|indian oil|hpcl|fastag/i, "Transportation"],
  [/amazon|flipkart|myntra|decathlon|croma|nykaa|shein/i, "Shopping"],
  [/pharma|medplus|apollo|hospital|clinic|practo|cult\.fit/i, "Healthcare"],
  [/bescom|electric|jio|airtel|fibernet|broadband|tata play|dth|recharge/i, "Utilities"],
  [/netflix|spotify|bookmyshow|pvr|steam|hotstar/i, "Entertainment"],
  [/udemy|coursera|school|college|tuition/i, "Education"],
  [/rent|nobroker|maintenance/i, "Housing"],
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Demo keyword rules standing in for the saved scikit-learn categorization pipeline. */
export function demoCategorize(description: string, type: "income" | "expense"): CategoryPrediction {
  const h = hash(description);
  const rule = RULES.find(([re]) => re.test(description));
  let predictedCategory: Category = rule ? rule[1] : "Other";
  let confidence = rule ? 0.78 + (h % 21) / 100 : 0.42 + (h % 20) / 100;
  if (type === "income" && predictedCategory !== "Income") {
    predictedCategory = "Income";
    confidence = 0.66;
  }
  confidence = Math.round(confidence * 100) / 100;
  return { predictedCategory, confidence, needsReview: confidence < 0.7 };
}

export const mockCategorizationService: CategorizationService = {
  async categorize(items) {
    await delay(900);
    return items.map((i) => demoCategorize(i.description, i.type));
  },
};
