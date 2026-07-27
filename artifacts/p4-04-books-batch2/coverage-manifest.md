# P4-04 Books Batch 2 coverage manifest

| Surface / state | Desktop | Mobile | Reduced motion | Fast jump | Resource lifecycle | Status |
| --- | --- | --- | --- | --- | --- | --- |
| BooksScene preload and role mapping | Verified | Verified | N/A | N/A | CPU owner dedup | Complete |
| BooksScene active progress and motion | Verified | Verified | Verified | Verified | cache retains | Complete |
| Three-cover renderer | Verified | Verified | Verified | Verified | 3 textures / 1 geometry / 3 materials | Complete |
| Responsive asset switch | Verified | Verified | N/A | Verified | old CPU/GPU source released | Complete |
| Missing anchor | Verified | Verified | Verified | Verified | no leak | Complete |
| Disposal isolation | Verified | Verified | N/A | N/A | Books leases zero; unrelated owners unchanged | Complete |
| Normal composited screenshot | Captured and inspected | Captured and inspected | Outside this capture set | Outside this capture set | Probe recorded | Complete |
| Canvas-only screenshot | Captured and inspected | Captured and inspected | Outside this capture set | Outside this capture set | Probe recorded | Complete |

All Batch 2 rows are complete. Formal Quote-to-Books orchestration, Books CameraIntent, and Books fallback/context-loss behavior remain deferred to Batch 3.
