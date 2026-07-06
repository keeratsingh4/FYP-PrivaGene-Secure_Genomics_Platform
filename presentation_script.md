# PrivaGene Presentation Script — Data & Deployment (Slides 7–9)

> **Your part:** Slides 7, 8, and 9  
> **Highlighted topics:** ClinVar Update · Database Design · Database Encryption  
> **Roughly 4–6 minutes total**

---

## 📌 Slide 7 — Section Divider: "Data & Deployment"

**Script:**

> "I'll now be taking over to cover the Data and Deployment section of PrivaGene — looking at how we sourced the data that powers the application, and how we took the system from a localhost environment to a live, production deployment."

*[Click to next slide]*

---

## 📌 Slide 8 — Real-World Data Acquisition

**Script:**

> "One of the first things we tried to do was get our hands on real, clinical genomic data — because the whole point of PrivaGene is to assess genetic risk against clinically relevant gene panels.
>
> We contacted **5 medical and clinical institutions** in Singapore: Singapore General Hospital, A\*STAR's Genome Institute of Singapore, CRIS/PRECISE, NUHS, and Mount Elizabeth Hospital.
>
> Out of all of those, only **CRIS responded**. And their response, while helpful, highlighted a real barrier: accessing cohort-level datasets like PRECISE-SG100K requires a formal Call for Proposals with a senior researcher as Lead PI. That's essentially a research-grant-level process, which is understandably beyond the scope of what we could do as undergraduates.
>
> However, CRIS did point us toward publicly available databases. Following that recommendation, we investigated two options: **gnomAD** and **ClinVar**.
>
> gnomAD is a large-scale genomics database that aggregates population-level variant data. The issue is that it provides aggregate statistics — not individual-level patient data — so it wasn't suitable for directly seeding our gene panels.
>
> **ClinVar**, on the other hand, was a perfect fit. It's a publicly accessible database maintained by NCBI — the National Centre for Biotechnology Information — and it specifically maps human genetic variants to disease conditions with clinical significance ratings. Essentially, it tells us: *which genes are associated with which diseases, and how confident is that association?*
>
> We used ClinVar to significantly expand our gene-disease reference data. Before this update, our disease gene panels were small and manually put together — for example, Breast Cancer only had 3 genes, and Alzheimer's had 4. After integrating ClinVar data, those panels became much more comprehensive and clinically authoritative.
>
> To give you a sense of the scale: across all **13 diseases** in the database — covering conditions from Breast Cancer and Type 2 Diabetes to Parkinson's and Cystic Fibrosis — we went from roughly **40 genes total to 102 clinically validated genes**. The sources are explicitly referenced in the migration file, citing ClinVar, the GWAS Catalog, and PubMed literature.
>
> Importantly though — as the slide notes — neither gnomAD nor ClinVar replaces actual patient data. So instead of using real patient genomes for testing, we validated the system using **controlled test data with known expected outcomes**, so we could verify the PSI risk computation was producing the right results."

---

## 📌 Slide 9 — Deployment: Localhost to Production

**Script:**

> "Now let's talk about how we took PrivaGene from running on localhost to an actual live deployment.
>
> We used **Render** as our hosting platform. Render is a cloud hosting service with a free tier that supports static sites, web services, and persistent disk storage — which made it well suited to our stack.
>
> **Frontend:** The frontend is built with vanilla HTML, CSS, and JavaScript — no framework needed — and it's deployed as a Render **static site**. One thing worth highlighting here is how we handled the switch between local and production environments. We have a `config.js` file that dynamically sets the API base URL depending on whether the app is running locally or on Render. So developers can work on localhost without touching any configuration, and the production build automatically points to the live backend. That's a small but important quality-of-life decision.
>
> **Backend:** The Node.js/Express backend is deployed as a Render **web service**. A key concern with any frontend-backend split like this is cross-origin requests — because the frontend and backend are on different domains in production. We handled this with CORS middleware configured in `cors.js`, which explicitly whitelists the production frontend URL and allows the appropriate HTTP methods and headers.
>
> **Database — this is the part I want to go into a bit more detail on.**
>
> We're using **SQLite**, which stores the entire database in a single file called `app.db`. On Render, this file sits on a **persistent disk**, which means it survives redeployments — unlike ephemeral storage, which gets wiped every time the container restarts.
>
> A key design decision we made was to have the server run database migrations **automatically on startup**. When the server starts, it reads the `migrations.sql` file and applies all table definitions and seed data. This means there's no manual setup step — you clone the repo, run `npm start`, and the database is ready to go. From an examiner or handover perspective, that's really important.
>
> The schema itself has 5 core tables: `users` for all account types, `diseases` and `disease_genes` for the ClinVar-sourced genetic data, `risk_assessments` for PSI outputs, and `audit_logs` for security tracking. We also use database indexes on frequently queried columns like `user_id`, `email`, and `timestamp` to keep queries efficient.
>
> On the security side — and this was something we were specifically asked to highlight — we have **two layers of data protection** in the database. First, all user passwords are hashed using **bcrypt** before being stored. Bcrypt is a one-way function, so raw passwords are never stored anywhere. Second, sensitive risk assessment data — specifically the matched gene lists and risk scores — are encrypted using **AES-256-CBC** via a dedicated `encryptionService.js`. Each encryption uses a unique random Initialisation Vector, so even identical values produce different ciphertext in the database. The encryption key is loaded from an environment variable, so it's never in the source code.
>
> **Challenges:** We did run into some real deployment challenges worth mentioning. Render's free tier has **cold starts** — if the service is idle, it spins down and takes 30–60 seconds to wake up when a request comes in. This is noticeable for the first request in a session. We also discovered that **redeployments would reset the database** if the persistent disk wasn't correctly attached, which we had to sort out early. And managing environment variables — like the encryption key and backend URL — across local and production configs required careful coordination between the frontend and backend config files.
>
> Overall, the deployment process taught us a lot about the practical gap between 'runs on my machine' and 'runs reliably in production'."

---

## 📋 Quick Reference (for Q&A)

| Stat | Value |
|------|-------|
| Institutions contacted | 5 (SGH, A\*STAR GIS, CRIS, NUHS, Mount Elizabeth) |
| Only responded | CRIS |
| Genes before ClinVar | ~40 |
| Genes after ClinVar | **102** across 13 diseases |
| Hosting platform | Render |
| Frontend type | Static site (HTML/CSS/JS) |
| Backend | Node.js / Express (Render web service) |
| Database | SQLite on persistent disk |
| DB auto-migration | Yes — runs on every server start |
| Password hashing | bcrypt (cost factor $2b$10$) |
| Risk data encryption | AES-256-CBC with random IV per value |
| Cold start time | 30–60 seconds (Render free tier) |
