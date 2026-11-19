# Acceptance scenarios — standalone phase 1

These are **manual scenarios, not completed test results**. Do not claim owner acceptance until these pass in an isolated Supabase + Vercel preview:

1. Register administrator, create institution `اختبار مستقل`, create a workshop for 2027. Confirm there are **no sample answers**.
2. Create three groups `أ`, `ب`, `ج`. Register nine distinct users with real Supabase Auth accounts. Each user opens the secure invite and is admitted only to that workshop.
3. Assign three members per group and mark one person as its recorder. Only the recorder and facilitator may edit group input.
4. Across all five stages (28 fields), enter different data for all three groups (84 group answers). Reload every browser and verify all content.
5. Enable individual input; each participant should edit only their own individual responses.
6. Close stage 2; confirm the recorder gets a server-side denial / zero updated rows. Reopen and confirm data remains intact.
7. Facilitator should see all group answers. Participants in group B should not read group A's private raw answers, even by direct REST calls.
8. Enter identical priorities in three groups, aggregate and ensure duplicate list has a single proposal and all three original raw entries are still present.
9. Open voting; record 9 distinct votes and confirm each person has at most one vote for a given priority. Close voting and ensure new votes are rejected server-side.
10. User with a valid session but **no invite** cannot query workshop or participants. An invite for workshop A cannot be used to read workshop B.
11. Export the five-sheet Excel workbook and inspect text/cell contents, prioritization votes, source provenance, and printing from Android/iOS browsers.
12. Confirm no reads, writes, imports, or credentials referencing ENJAZ AI production.
13. Owner signs off explicitly. Only then start planning phase 2 (strategies, annual plans, budgets, analytics).
