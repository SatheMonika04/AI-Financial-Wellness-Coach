import { format, getDaysInMonth, startOfMonth, subMonths } from "date-fns";
import type { AnomalyResult, Category, PaymentMethod, Transaction, TransactionType } from "@/types";
import { TODAY } from "@/lib/period";

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Merchant = { merchant: string; description: string; min: number; max: number; methods: PaymentMethod[] };

const POOLS: Record<string, Merchant[]> = {
  Groceries: [
    { merchant: "BigBasket", description: "BigBasket order – weekly groceries", min: 900, max: 3200, methods: ["UPI", "Credit Card"] },
    { merchant: "Blinkit", description: "Blinkit – quick commerce order", min: 250, max: 1400, methods: ["UPI"] },
    { merchant: "Zepto", description: "Zepto – groceries & essentials", min: 200, max: 1200, methods: ["UPI"] },
    { merchant: "DMart", description: "DMart – household supplies", min: 1200, max: 4200, methods: ["Debit Card", "UPI"] },
    { merchant: "Reliance Fresh", description: "Reliance Fresh – fruits & vegetables", min: 300, max: 1100, methods: ["UPI", "Cash"] },
  ],
  Dining: [
    { merchant: "Swiggy", description: "Swiggy – food delivery", min: 220, max: 950, methods: ["UPI", "Credit Card"] },
    { merchant: "Zomato", description: "Zomato – food delivery", min: 250, max: 1100, methods: ["UPI", "Credit Card"] },
    { merchant: "Starbucks", description: "Starbucks – Indiranagar", min: 280, max: 750, methods: ["Credit Card", "UPI"] },
    { merchant: "Haldiram's", description: "Haldiram's – dine-in", min: 350, max: 1200, methods: ["UPI", "Cash"] },
    { merchant: "Truffles", description: "Truffles – Koramangala", min: 600, max: 1800, methods: ["Credit Card"] },
  ],
  Transportation: [
    { merchant: "Uber", description: "Uber ride", min: 140, max: 650, methods: ["UPI", "Credit Card"] },
    { merchant: "Ola", description: "Ola cab ride", min: 120, max: 580, methods: ["UPI"] },
    { merchant: "Rapido", description: "Rapido bike taxi", min: 45, max: 180, methods: ["UPI"] },
    { merchant: "Indian Oil", description: "Indian Oil – petrol refill", min: 900, max: 2400, methods: ["Credit Card", "UPI"] },
    { merchant: "Namma Metro", description: "Namma Metro card recharge", min: 200, max: 500, methods: ["UPI"] },
  ],
  Shopping: [
    { merchant: "Amazon", description: "Amazon.in order", min: 450, max: 4800, methods: ["Credit Card", "UPI"] },
    { merchant: "Flipkart", description: "Flipkart order", min: 400, max: 5200, methods: ["Credit Card", "UPI"] },
    { merchant: "Myntra", description: "Myntra – apparel", min: 800, max: 3800, methods: ["Credit Card"] },
    { merchant: "Nykaa", description: "Nykaa – personal care", min: 350, max: 1800, methods: ["UPI"] },
    { merchant: "Decathlon", description: "Decathlon – sports gear", min: 700, max: 3500, methods: ["Debit Card"] },
  ],
  Healthcare: [
    { merchant: "Apollo Pharmacy", description: "Apollo Pharmacy – medicines", min: 180, max: 1600, methods: ["UPI"] },
    { merchant: "PharmEasy", description: "PharmEasy – medicines", min: 250, max: 1400, methods: ["UPI"] },
    { merchant: "Practo", description: "Practo – doctor consultation", min: 500, max: 900, methods: ["UPI", "Credit Card"] },
  ],
  Entertainment: [
    { merchant: "BookMyShow", description: "BookMyShow – movie tickets", min: 350, max: 1200, methods: ["UPI", "Credit Card"] },
    { merchant: "PVR INOX", description: "PVR INOX – cinema", min: 400, max: 1300, methods: ["Credit Card"] },
    { merchant: "Steam", description: "Steam – game purchase", min: 300, max: 1500, methods: ["Credit Card"] },
  ],
  Education: [
    { merchant: "Udemy", description: "Udemy – online course", min: 449, max: 799, methods: ["Credit Card"] },
    { merchant: "Coursera", description: "Coursera – specialization", min: 1800, max: 3500, methods: ["Credit Card"] },
  ],
  Other: [
    { merchant: "Urban Company", description: "Urban Company – home cleaning", min: 450, max: 1800, methods: ["UPI"] },
    { merchant: "UPI – Ravi Kumar", description: "UPI transfer to Ravi Kumar", min: 200, max: 2500, methods: ["UPI"] },
    { merchant: "India Post", description: "India Post – courier", min: 80, max: 350, methods: ["Cash"] },
  ],
};

const MONTHLY_COUNTS: Record<string, number> = {
  Groceries: 7,
  Dining: 9,
  Transportation: 8,
  Shopping: 3,
  Healthcare: 1,
  Entertainment: 2,
  Other: 1,
};

function anomaly(partial: Omit<AnomalyResult, "flagged" | "source" | "reviewHistory" | "threshold" | "detectedAt"> & { detectedAt: string; history?: AnomalyResult["reviewHistory"] }): AnomalyResult {
  const { history, ...rest } = partial;
  return {
    flagged: true,
    source: "demo",
    threshold: 0,
    reviewHistory: [{ at: partial.detectedAt, action: "flagged", note: "Flagged by demo anomaly rules" }, ...(history ?? [])],
    ...rest,
  };
}

export function generateDemoTransactions(today = TODAY): Transaction[] {
  const rand = mulberry32(20261009);
  const r = (min: number, max: number) => min + rand() * (max - min);
  const ri = (min: number, max: number) => Math.round(r(min, max));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const out: Transaction[] = [];
  let n = 0;

  const push = (
    d: Date | null,
    p: { merchant: string; description: string; category: Category; type?: TransactionType; amount: number; method: PaymentMethod; recurring?: boolean; anomaly?: AnomalyResult; m: number },
  ) => {
    if (!d) return;
    const conf = rand() < 0.08 ? r(0.46, 0.69) : r(0.76, 0.99);
    let status: Transaction["status"] = "completed";
    if (p.m === 0 && today.getDate() - d.getDate() <= 1 && rand() < 0.35) status = "pending";
    else if (rand() < 0.008) status = "failed";
    out.push({
      id: `txn_${String(++n).padStart(4, "0")}`,
      date: format(d, "yyyy-MM-dd'T'HH:mm"),
      merchant: p.merchant,
      description: p.description,
      category: p.category,
      type: p.type ?? "expense",
      paymentMethod: p.method,
      amount: Math.round(p.amount),
      status: p.anomaly ? "completed" : status,
      prediction: { predictedCategory: p.category, confidence: Math.round(conf * 100) / 100, needsReview: conf < 0.7 },
      anomaly: p.anomaly,
      source: "demo",
      recurring: p.recurring,
    });
  };

  for (let m = 11; m >= 0; m--) {
    const ms = startOfMonth(subMonths(today, m));
    const dim = getDaysInMonth(ms);
    const last = m === 0 ? today.getDate() : dim;
    const at = (day: number, h = ri(8, 21), min = ri(0, 59)) => {
      if (day > last) return null;
      const hour = m === 0 && day === last ? Math.min(h, 17) : h;
      return new Date(ms.getFullYear(), ms.getMonth(), day, hour, min);
    };
    const month = ms.getMonth();

    push(at(1, 9, 5), { m, merchant: "Infosys Ltd", description: "Salary credit – Infosys Ltd (NEFT)", category: "Income", type: "income", amount: m >= 6 ? 92000 : 95000, method: "Net Banking", recurring: true });
    if (m % 3 === 1) push(at(ri(10, 20)), { m, merchant: "Upwork", description: "Freelance payout – Upwork", category: "Income", type: "income", amount: ri(14000, 22000), method: "Net Banking" });
    if (m % 4 === 2) push(at(ri(5, 25)), { m, merchant: "Zerodha", description: "Dividend credit – Zerodha", category: "Income", type: "income", amount: ri(1200, 3400), method: "Net Banking" });

    push(at(3, 8, 0), { m, merchant: "NoBroker", description: "Monthly rent – NoBroker Pay", category: "Housing", amount: 22000, method: "Auto Debit", recurring: true });
    push(at(7, 10, 15), { m, merchant: "BESCOM", description: "BESCOM electricity bill", category: "Utilities", amount: month >= 3 && month <= 5 ? ri(2400, 3200) : ri(1300, 2100), method: "UPI", recurring: true });
    push(at(5, 11, 30), { m, merchant: "ACT Fibernet", description: "ACT Fibernet broadband", category: "Utilities", amount: 1059, method: "Auto Debit", recurring: true });
    push(at(12, 12, 10), { m, merchant: "Jio", description: "Jio postpaid recharge", category: "Utilities", amount: 749, method: "UPI", recurring: true });
    push(at(15, 6, 0), { m, merchant: "Netflix", description: "Netflix subscription", category: "Entertainment", amount: 649, method: "Credit Card", recurring: true });
    push(at(20, 6, 0), { m, merchant: "Spotify", description: "Spotify Premium", category: "Entertainment", amount: 119, method: "Credit Card", recurring: true });
    push(at(2, 7, 0), { m, merchant: "Cult.fit", description: "Cult.fit membership", category: "Healthcare", amount: 1999, method: "Auto Debit", recurring: true });

    const scale = last / dim;
    for (const [cat, count] of Object.entries(MONTHLY_COUNTS)) {
      const k = Math.round(count * scale * r(0.8, 1.25));
      for (let i = 0; i < k; i++) {
        const mer = pick(POOLS[cat]);
        const factor = cat === "Dining" && m === 0 ? 1.18 : cat === "Shopping" && (month === 9 || month === 10) ? 1.3 : 1;
        push(at(ri(1, last)), { m, merchant: mer.merchant, description: mer.description, category: cat as Category, amount: r(mer.min, mer.max) * factor, method: pick(mer.methods) });
      }
    }
    if (rand() < 0.35) {
      const mer = pick(POOLS.Education);
      push(at(ri(1, last)), { m, merchant: mer.merchant, description: mer.description, category: "Education", amount: r(mer.min, mer.max), method: pick(mer.methods) });
    }
  }

  // Injected unusual transactions (demo examples of model output).
  const mk = (m: number, day: number, h: number, min: number) => {
    const ms = startOfMonth(subMonths(today, m));
    const d = new Date(ms.getFullYear(), ms.getMonth(), day, h, min);
    return d <= today ? d : null;
  };
  const iso = (d: Date | null) => (d ? format(d, "yyyy-MM-dd'T'HH:mm") : "");
  const specs: { m: number; day: number; h: number; min: number; merchant: string; description: string; category: Category; amount: number; method: PaymentMethod; a: Omit<Parameters<typeof anomaly>[0], "detectedAt"> }[] = [
    { m: 1, day: 6, h: 2, min: 14, merchant: "Croma", description: "Croma – electronics purchase", category: "Shopping", amount: 48999, method: "Credit Card",
      a: { score: -0.214, severity: "high", reviewStatus: "new", typicalAmount: 2400, reasons: ["The amount is unusually high compared with your typical spending at this merchant.", "This transaction occurred at an unusual time (2:14 AM)."], featureContributions: [{ feature: "amount_zscore", value: "+6.8σ" }, { feature: "hour_of_day", value: "02:00" }, { feature: "merchant_frequency", value: "1st visit in 6 months" }] } },
    { m: 0, day: 4, h: 22, min: 41, merchant: "Swiggy", description: "Swiggy – large party order", category: "Dining", amount: 6840, method: "UPI",
      a: { score: -0.087, severity: "medium", reviewStatus: "new", typicalAmount: 560, reasons: ["The amount is unusually high compared with your typical spending at this merchant."], featureContributions: [{ feature: "amount_zscore", value: "+4.1σ" }, { feature: "category_share_week", value: "38%" }] } },
    { m: 0, day: 8, h: 23, min: 52, merchant: "Uber", description: "Uber ride – airport", category: "Transportation", amount: 2340, method: "Credit Card",
      a: { score: -0.031, severity: "low", reviewStatus: "new", typicalAmount: 330, reasons: ["This transaction occurred at an unusual time.", "Distance-based fare is much higher than your usual rides."], featureContributions: [{ feature: "hour_of_day", value: "23:00" }, { feature: "amount_zscore", value: "+2.6σ" }] } },
    { m: 1, day: 18, h: 1, min: 7, merchant: "SHEIN Intl", description: "International card txn – SHEIN SG", category: "Shopping", amount: 12450, method: "Credit Card",
      a: { score: -0.172, severity: "high", reviewStatus: "new", typicalAmount: 2100, reasons: ["This merchant or category differs from your historical transaction pattern.", "International transaction in a foreign currency."], featureContributions: [{ feature: "merchant_seen_before", value: "No" }, { feature: "is_international", value: "Yes" }] } },
    { m: 1, day: 15, h: 6, min: 2, merchant: "Netflix", description: "Netflix subscription (second charge)", category: "Entertainment", amount: 649, method: "Credit Card",
      a: { score: -0.022, severity: "low", reviewStatus: "new", typicalAmount: 649, reasons: ["Possible duplicate: a charge for the same amount at this merchant was made on the same day."], featureContributions: [{ feature: "same_day_same_amount", value: "2 charges" }] } },
    { m: 1, day: 22, h: 14, min: 20, merchant: "Indian Oil", description: "Indian Oil – fuel", category: "Transportation", amount: 9200, method: "Credit Card",
      a: { score: -0.064, severity: "medium", reviewStatus: "reviewed", typicalAmount: 1650, reasons: ["The amount is unusually high compared with your typical spending at this merchant."], featureContributions: [{ feature: "amount_zscore", value: "+3.9σ" }],
        history: [{ at: iso(mk(1, 23, 10, 0)), action: "reviewed", note: "Road trip to Coorg – expected" }] } },
    { m: 2, day: 9, h: 16, min: 45, merchant: "Apollo Hospitals", description: "Apollo Hospitals – outpatient procedure", category: "Healthcare", amount: 27500, method: "Debit Card",
      a: { score: -0.118, severity: "medium", reviewStatus: "dismissed", typicalAmount: 900, reasons: ["The amount is unusually high for the Healthcare category."], featureContributions: [{ feature: "category_amount_zscore", value: "+5.2σ" }],
        history: [{ at: iso(mk(2, 10, 9, 30)), action: "dismissed", note: "Planned procedure" }] } },
    { m: 3, day: 27, h: 3, min: 40, merchant: "UPI – 98xxxx4410", description: "UPI transfer to unknown payee", category: "Other", amount: 15000, method: "UPI",
      a: { score: -0.193, severity: "high", reviewStatus: "reviewed", typicalAmount: 1100, reasons: ["This merchant or category differs from your historical transaction pattern.", "This transaction occurred at an unusual time."], featureContributions: [{ feature: "payee_seen_before", value: "No" }, { feature: "hour_of_day", value: "03:00" }],
        history: [{ at: iso(mk(3, 27, 11, 0)), action: "reviewed", note: "Paid electrician – confirmed" }] } },
    { m: 4, day: 11, h: 13, min: 5, merchant: "MakeMyTrip", description: "MakeMyTrip – flight booking", category: "Other", amount: 38600, method: "Credit Card",
      a: { score: -0.041, severity: "low", reviewStatus: "dismissed", typicalAmount: 0, reasons: ["This merchant or category differs from your historical transaction pattern."], featureContributions: [{ feature: "merchant_seen_before", value: "No" }],
        history: [{ at: iso(mk(4, 12, 8, 0)), action: "dismissed", note: "Family vacation" }] } },
  ];
  for (const s of specs) {
    const d = mk(s.m, s.day, s.h, s.min);
    if (!d) continue;
    push(d, { m: s.m, merchant: s.merchant, description: s.description, category: s.category, amount: s.amount, method: s.method, anomaly: anomaly({ ...s.a, detectedAt: iso(d) }) });
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
