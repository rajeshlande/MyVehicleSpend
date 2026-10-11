# User Requirements Specification (URS) — My Vehicle Spend

| Field | Value |
|---|---|
| Version | 1.0 (Draft) |
| Date | 2026-10-11 |

This document states what the vehicle owner needs, in the owner's language. Technical detail is in the SRS.

## 1. Who is the user?

- **Priya-type owner:** salaried professional with one car and a home loan-style car EMI, uses UPI for most payments, checks phone daily.
- **Ravi-type owner:** daily commuter on a bike, fuels every 3–4 days, wants to know mileage and cost per km.
- **Family owner:** manages two vehicles, one loan, pays for service at a local garage.

Users are comfortable with Hindi/English mix, may have limited patience for long forms, and often log expenses on the go.

## 2. User Needs

| ID | I need to… | So that… | Priority |
|---|---|---|---|
| UR-01 | add my car or bike with its number and basic details | I can track it | Must |
| UR-02 | add more than one vehicle | I can track family cars or a car and a bike | Must |
| UR-03 | log a petrol fill in a few taps | I don't skip entries | Must |
| UR-04 | see my mileage automatically | I know if the vehicle is performing well | Must |
| UR-05 | log a service bill with parts and labour and GST | I know what the service really cost | Must |
| UR-06 | log FASTag recharges and tolls | my highway costs are complete | Must |
| UR-07 | log my insurance premium and see renewal date | I never let the policy lapse | Must |
| UR-08 | be reminded of PUC, insurance, licence expiry | I avoid fines | Must |
| UR-09 | record a challan / traffic fine | I know my penalty total | Should |
| UR-10 | record RTO costs such as road tax, RC, NOC, transfer | my registration costs are visible | Must |
| UR-11 | enter my car loan details and see the EMI schedule | I know how much interest I pay | Must |
| UR-12 | record each EMI I actually paid | I can match with the bank statement | Must |
| UR-13 | see what I'd save if I prepay or foreclose | I can decide whether to do it | Should |
| UR-14 | see total cost per month and per km | I know the true cost of ownership | Must |
| UR-15 | see a chart of where money goes | I can spot overspending | Must |
| UR-16 | view the financial year (April–March) total | it matches my tax and budget planning | Should |
| UR-17 | export my data to Excel | I can share it with my accountant or insurer | Must |
| UR-18 | attach a photo of the bill | I have proof | Should |
| UR-19 | use the app without internet, e.g. in a basement parking | I don't lose entries | Should |
| UR-20 | install the app on my home screen | it feels like a normal app | Must |
| UR-21 | keep my data private | no one else can see my spending | Must |
| UR-22 | back up and restore my data | I don't lose it if I change phones | Must |
| UR-23 | delete my account and data | I can leave the service | Must |
| UR-24 | track EV charging in kWh and cost per unit | my EV running cost is accurate | Should |
| UR-25 | record a loan prepayment or foreclosure charge | the loan balance stays correct | Should |

## 3. Usage Scenarios

### Scenario S1 — Quick fuel entry
1. Ravi opens the app from the home screen and taps **+ Fuel**.
2. He enters odometer, litres and price; the total is calculated.
3. He taps **Save**. The dashboard shows updated km/l.
*Success:* entry saved in ≤ 20 seconds, even offline.

### Scenario S2 — Insurance renewal
1. Priya receives the insurer's renewal email.
2. She opens the insurance reminder, taps **Renew**, enters premium and new expiry.
3. The app records the expense and schedules the next reminder 15 days before expiry.

### Scenario S3 — Car loan review
1. Priya opens the Loan screen for her car.
2. She sees outstanding principal, interest paid so far, and months remaining.
3. She simulates a ₹2,00,000 prepayment to see how many months it saves.

### Scenario S4 — Monthly report for accountant
1. Owner selects *This financial year*.
2. Taps **Export CSV**; opens the file in Excel with rupee totals intact.

## 4. Constraints from the User's View
- Must be free to use.
- Must not require installing from an app store.
- Must not show intrusive ads.
- Data entry must be possible in Indian-English and numbers in lakh format.

## 5. Acceptance Statement
The URS is satisfied when the owner can complete scenarios S1–S4 without assistance, and all Must needs (UR-xx marked Must) are demonstrably met in UAT.
