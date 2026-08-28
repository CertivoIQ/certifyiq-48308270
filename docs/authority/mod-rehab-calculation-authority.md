# Section 8 Moderate Rehabilitation calculation authority

CertivoIQ's Mod Rehab family calculation path is intentionally separate from tenant-based HCV and PBV.

Controlled implementation sources:

- HUD Form 50058 Instruction Booklet, effective January 1, 2024, Section 13 (Moderate Rehabilitation).
- 24 CFR Part 882 for the Section 8 Moderate Rehabilitation program.
- HUD PIH handbook materials for Moderate Rehabilitation rents and contract administration.

Implemented Section 13 mechanics:

1. Current contract rent to owner = current base rent + monthly rehabilitation debt service.
2. Gross rent = contract rent to owner + tenant-paid utility allowance.
3. Tenant rent to owner = TTP - utility allowance, floored at zero; a negative result is represented as utility reimbursement.
4. HAP to owner = contract rent to owner - tenant rent to owner.
5. Normal total HAP = gross rent - TTP, floored at zero.
6. Mixed-family proration uses eligible family members / total family members against normal total HAP, then derives mixed-family TTP, tenant rent, utility reimbursement, and HAP to owner.

Release gate:

The calculation fails closed unless the controlled Mod Rehab source is explicitly validated. Missing contract-rent components or missing/invalid mixed-family counts also block validation. This avoids reusing HCV payment standards or PBV rent-to-owner logic for Mod Rehab.
