# Business Requirements Document (BRD) — My Vehicle Spend

| Field   | Value                     |
| ------- | ------------------------- |
| Version | 1.0 (Draft)               |
| Date    | 2026-10-11                |
| Related | Project Charter, SRS, URS |

## 1. Business Need

Indian vehicle owners lack a single, India-aware tool to record recurring and irregular vehicle costs and to understand loan burden. The current practice (notebooks, scattered UPI receipts, spreadsheets) leads to missed renewals (insurance lapse, PUC fines, challans) and underestimated running costs.

## 2. Business Objectives

| ID   | Objective                                                          |
| ---- | ------------------------------------------------------------------ |
| BO-1 | Provide accurate, categorised record of all vehicle expenses       |
| BO-2 | Prevent missed renewals (insurance, PUC, licence)                  |
| BO-3 | Quantify true cost of ownership (₹/month, ₹/km)                    |
| BO-4 | Track loan principal, interest and EMI status                      |
| BO-5 | Keep operating cost at ₹0 using open-source and free-tier services |

## 3. Stakeholders

| Stakeholder                           | Interest                  | Influence |
| ------------------------------------- | ------------------------- | --------- |
| Owner-operator (car or bike)          | Uses the app daily/weekly | High      |
| Product owner                         | Scope & sign-off          | High      |
| Developer / maintainer                | Build, deploy, maintain   | High      |
| Potential co-owners / family (future) | Shared access             | Low (v2)  |

## 4. Business Requirements

| BR-ID | Requirement                                                                                                                                                 | Priority | Objective |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------- |
| BR-01 | The system shall let a user register one or more vehicles (car, bike, scooter) with registration number, make, model, variant, fuel type and purchase date. | Must     | BO-1      |
| BR-02 | The system shall record expenses against a vehicle using Indian expense categories listed in Appendix A.                                                    | Must     | BO-1      |
| BR-03 | The system shall calculate fuel efficiency (km/l) and cost per km.                                                                                          | Must     | BO-3      |
| BR-04 | The system shall remind the owner before insurance, PUC, licence or other document expiry.                                                                  | Must     | BO-2      |
| BR-05 | The system shall track vehicle loans with EMI schedule, interest component and outstanding balance.                                                         | Must     | BO-4      |
| BR-06 | The system shall support loan prepayment and foreclosure simulation.                                                                                        | Should   | BO-4      |
| BR-07 | The system shall produce monthly, yearly and category-wise summaries.                                                                                       | Must     | BO-3      |
| BR-08 | The system shall allow export of user data to CSV for personal records or tax/insurance claims.                                                             | Should   | BO-1      |
| BR-09 | The system shall be accessible on mobile and desktop as an installable web app.                                                                             | Must     | BO-5      |
| BR-10 | The system shall operate at zero recurring cost on free tiers.                                                                                              | Must     | BO-5      |
| BR-11 | The system shall keep each user's data private from other users.                                                                                            | Must     | BO-1      |

## 5. Business Rules

| ID      | Rule                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RULE-01 | Currency is INR. Amounts are displayed with Indian grouping (₹1,23,456.00).                                                                                        |
| RULE-02 | Dates display as DD/MM/YYYY; the database stores ISO 8601.                                                                                                         |
| RULE-03 | Odometer readings must not decrease for the same vehicle.                                                                                                          |
| RULE-04 | Loan interest uses the reducing-balance method (standard for Indian retail vehicle loans) unless the lender states flat-rate; flat-rate is supported as an option. |
| RULE-05 | GST component is recorded separately for service and parts where the bill shows it.                                                                                |
| RULE-06 | Deleting a vehicle requires confirmation and removes its linked records.                                                                                           |

## 6. Success Criteria

- All Must requirements delivered and passing UAT (see UAT Report).
- Monthly totals reconcile with manually entered sample data to ₹0.00 difference.
- App lighthouse PWA installability check passes.
- Running cost after launch: ₹0/month.

## 7. Risks (Business View)

| Risk                             | Impact                         | Mitigation                                         |
| -------------------------------- | ------------------------------ | -------------------------------------------------- |
| Free-tier pause after inactivity | Data unavailable until resumed | Keep-alive ping; documented restore steps          |
| Users abandon manual entry       | Low data quality               | Quick-add flow, fuel shortcut, recurring templates |
| Financial data exposure          | High                           | RLS, HTTPS-only, no PII in logs                    |

## Appendix A — Indian Vehicle Expense Categories

**A1. Fuel & Energy**
Petrol, Diesel, CNG, LPG, Electric charging (home / public / swap), Two-wheeler battery top-up.

**A2. Insurance**
Third-party liability, Comprehensive / own-damage, Zero-depreciation add-on, Engine protect, Roadside assistance, Personal accident cover for owner-driver, No-claim bonus notes, Insurance renewal fee.

**A3. Government, Registration & Taxes**
Road tax (one-time or lifetime tax), Annual / quarterly token tax (where applicable), Registration (RC) fee, Smart card / RC printing fee, Fitness certificate (FC), Pollution Under Control (PUC) certificate, Permit / national permit (commercial, if applicable), Hypothecation / NOC fee, Ownership transfer fee, Number plate (HSRP) fee, Duplicate RC fee, Learner's / driving licence fee and renewal, Green tax (where applicable).

**A4. Tolls & Roads**
FASTag recharge, Cash toll, Parking (street / mall / monthly), Parking fine.

**A5. Maintenance & Service**
Periodic service, Engine oil & filter, Air filter, Brake pads/shoes, Brake fluid, Clutch plate/cable, Chain & sprocket (bike), Battery replacement, Tyres (new), Tyre puncture repair, Wheel alignment & balancing, Wheel bearing, Suspension, Coolant, Spark plugs, Wiper blades, Bulbs/lights, AC service & gas refill, Wash & detailing, Denting/painting, Mechanic labour charges, Towing.

**A6. Accessories & Upgrades**
Seat cover, Music system, Dashcam, Mobile holder, Crash guard, Rear camera, Tinted films, Roof rack, Accessories GST.

**A7. Traffic & Penalties**
Traffic challan (e-challan, manual), Overspeed fine, No-parking fine, No-helmet / seat belt fine, Late renewal penalty.

**A8. Loan & Finance Costs**
EMI payment, Loan processing fee, Documentation charge, Interest component (computed), Prepayment charge, Foreclosure charge, Late payment penalty, Bounce charge, Loan insurance premium.

**A9. Other**
Driver salary (if any), Fuel for driver meals (optional), Cab/auto fare when car is unavailable, Miscellaneous.

## Appendix B — Glossary

| Term          | Meaning                              |
| ------------- | ------------------------------------ |
| EMI           | Equated Monthly Instalment           |
| IDV           | Insured Declared Value               |
| PUC           | Pollution Under Control certificate  |
| RC            | Registration Certificate             |
| RTO           | Regional Transport Office            |
| FASTag        | RFID toll tag                        |
| Hypothecation | Loan lien recorded on the RC         |
| NOC           | No Objection Certificate             |
| HSRP          | High Security Registration Plate     |
| Foreclosure   | Full loan closure before tenure ends |
