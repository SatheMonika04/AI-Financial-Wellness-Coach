# API integration map

All private routes use the signed `moneymind_session` cookie and derive record ownership from the authenticated server session. State-changing requests with a browser Origin are subject to `AuthOriginMiddleware`.

| Method | Path | Purpose | Auth | Response |
|---|---|---|---|---|
| POST | `/api/auth/signup` | Create account | Public | Safe user profile, 201 |
| POST | `/api/auth/login` | Start session | Public | Safe user profile and HttpOnly cookie |
| GET | `/api/auth/me` | Restore session | Required | Safe user profile |
| POST | `/api/auth/logout` | End session | Cookie/origin protected | `{message}` |
| GET | `/health` | Process health | Public | `{status: "ok"}` |
| GET | `/ready` | Database readiness | Public | `{status: "ready"}`; database failure is an error |
| GET | `/api/transactions` | List owned transactions; accepts `page`, `page_size`, `category`, `transaction_type`, `search`, `start_date`, `end_date` | Required | `{items,total,page,pageSize}` |
| GET | `/api/transactions/{transaction_id}` | Read owned transaction | Required | Transaction object |
| POST | `/api/transactions/import` | Validate, deduplicate and persist imported rows | Required | Counts, invalid row details, saved transactions |
| PATCH | `/api/transactions/{transaction_id}` | Update supported transaction fields | Required | Updated transaction object |
| DELETE | `/api/transactions/{transaction_id}` | Delete owned transaction | Required | 204 |
| POST | `/api/statements/upload` | Parse CSV or supported PDF to preview rows | Required | `{fileName,fileType,headers,rows,suggestedMapping}` |
| GET | `/api/dashboard/summary` | Deterministic lifetime cash flow and category totals | Required | `{income,expenses,netCashFlow,savingsRate,categoryExpenses,transactionCount}` |
| GET | `/api/budgets` | List owned category limits with current month spending progress | Required | Array of `{category,monthlyLimit,spent,remaining,percentUsed}` |
| PUT | `/api/budgets/{category}` | Create or update a category monthly limit | Required | Budget progress object |
| DELETE | `/api/budgets/{category}` | Delete an owned budget limit | Required | 204 |
| GET | `/api/goals` | List owned savings goals | Required | Array of goal objects |
| POST | `/api/goals` | Create a savings goal | Required | Goal object, 201 |
| PATCH | `/api/goals/{goal_id}` | Update an owned goal and progress | Required | Goal object |
| DELETE | `/api/goals/{goal_id}` | Delete an owned goal | Required | 204 |
| GET | `/api/preferences` | Load financial profile and app preferences | Required | `{profile,settings}` |
| PUT | `/api/preferences` | Save profile and preferences | Required | `{profile,settings}` |
| POST | `/api/ml/categorize` | Classify transaction descriptions with the saved v6 pipeline | Required | Array of `{predictedCategory,confidence,needsReview}` |
| POST | `/api/ml/anomalies` | Score selected owned transactions with the saved Isolation Forest | Required | Run counts and per-transaction model results |
| PATCH | `/api/ml/anomalies/{transaction_id}/review` | Persist an owned anomaly review | Required | 204 |
| GET | `/api/ml/budget-recommendations` | Recommend category limits using the saved random forest and profile/transaction data | Required | `{recommendations,generatedAt,source}`; requires profile income and demographic/financial inputs |
| POST | `/api/ml/forecast` | Project daily spending from 56-day weekday and overall averages; includes category mix for 30 days | Required | Daily points, category projections, and a `calculation` source label; requires 30 calendar days of history |
| GET | `/api/wellness/score` | Calculate a score from saved transactions, budgets, goals and profile | Required | `{overall,level,components,factors,recommendations,source,period}` |

The frontend uses `/api/transactions`, `/api/statements/upload`, `/api/budgets`, `/api/goals`, `/api/preferences`, `/api/ml/categorize`, `/api/ml/anomalies`, `/api/ml/budget-recommendations`, `/api/ml/forecast`, and `/api/wellness/score`. Forecasting uses a transparent historical baseline because the saved ML artifact target does not match the daily future forecast UI contract.

## Schema update

On backend startup, `Base.metadata.create_all()` adds missing tables without dropping or resetting existing tables. This repeatable additive update creates `financial_transactions`, `financial_budgets`, `savings_goals`, `user_preferences`, and `financial_anomaly_reviews` when absent. It does not migrate or rewrite existing financial rows. To apply it, start the backend after configuring `DATABASE_URL`; no manual migration command is required. PostgreSQL execution was not verified in this environment.

## Run

From the repository root, with `.env` populated using the documented variables:

```powershell
venv\Scripts\python.exe -m uvicorn src.main:app --reload --port 8000
npm.cmd run dev
```

`DATABASE_URL`, `SESSION_SECRET` (32+ characters), optional `FRONTEND_ORIGINS`, optional `COOKIE_SECURE`, and frontend `VITE_API_BASE_URL` configure the integration. Do not commit `.env`.
