# Design implementation plan — "Base" template (23 screens)

Source: 23 PNG attachments in `/home/user/uploads/` (Dashboard, Analytics/Customer List, Add Customer, Product Analytics, Add Product, Invoice List, Create Invoice, Schedule List, Calendar day/week/month/year, Create Event, Task Preview board/list/timeline, Messages/Chat, Login, Sign Up, Recover, Account created, Dashboard navigation, Invoice dropdown, Confirm).
The Figma link could not be opened (it redirects to the Figma home page), so the PNGs are the reference.

## Decisions (from owner, 2026-10-13)

- Scope: full template, all 23 screens, built in vertical slices.
- Sign-in: email and password only. No Google or Facebook buttons (OAuth is not configured).
- Look: the new design replaces the current look.
- Brand: keep "My Vehicle Spend" and our existing logo mark's place. Do not copy the template's "Base" name or its illustrations.

## Open points (to confirm before the slice that needs them)

1. Sidebar mapping of vehicle features to the template nav (Dashboard, Analytics, Invoice, Schedule, Calendar, Messages, Notification, Settings). Proposed in slice 2.
2. The template's customers, products, invoices, tasks and chat have no data model in this app. Each needs tables, RLS and tests (see slices 4–7). Confirm they are wanted as real features, not mock data.
3. Sign-up fields. The design has Full Name and Username and a terms checkbox. Our sign-up has email and password only. Adding fields needs profile columns and a consent record.

## Slices

| #                                                                                       | Slice                                                                                                        | Status                                                                                                                                     |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1                                                                                       | Design tokens (palette, type, radius, cards). Login, Sign Up, Recover, Account created screens.              | Done                                                                                                                                       |
| 2                                                                                       | App shell: sidebar with the template nav and the top bar. Mobile bottom bar kept.                            | Done                                                                                                                                       |
| 3                                                                                       | Dashboard (Home) and Analytics: stat cards, line and donut charts, recent orders, top products.              | Done (Recent orders and top products wait for slices 5 and 7)                                                                              |
| Calendar (day, week, month, year), Create Event modal, Schedule list. Reuses reminders. | Partly done: month, day, week and year views, Schedule rows. Open: Create event (needs a decision on events) |
| 5                                                                                       | Invoices: list with status and bulk select, create invoice with preview and totals.                          | Done for vehicle service bills (scope chosen by you). Bulk select and invoice preview not built; customer and product billing out of scope |
| 6                                                                                       | Customers: list, add customer panel, customer detail panel with performance.                                 | Planned                                                                                                                                    |
| 7                                                                                       | Products: product analytics, add product panel, top selling table.                                           | Planned                                                                                                                                    |
| 8                                                                                       | Tasks: board, list and timeline views, filter, search, add task.                                             | Planned                                                                                                                                    |
| 9                                                                                       | Messages: chat list (all, personal, teams) and conversation view.                                            | Planned                                                                                                                                    |
| 10                                                                                      | Notifications and Settings screens, confirm dialog, dropdown menus.                                          | Planned                                                                                                                                    |

Each slice: failing test first, then implementation, then the full gate, then one commit. Accessibility (axe, contrast), the bundle budget and the keyboard check run again at the end.
