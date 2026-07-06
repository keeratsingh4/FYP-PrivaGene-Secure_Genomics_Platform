# PrivaGene

A privacy-preserving genetic risk assessment platform using Private Set Intersection (PSI). Patients can assess their genetic disease risk without exposing their raw genetic data to healthcare providers, and hospitals' disease-associated genes remain hidden from patients.

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: SQLite

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)

## Installation

1. **Clone or download the project**

2. **Install backend dependencies**
```bash
   cd BackEnd/DBMS
   npm install sqlite3
   
   cd ../Server
   npm install
```

## Running the Application

1. **Start the backend server**
   cd BackEnd/Server

   Then run either of these commands:
   `node server.js`
   OR
   `npm start`

   Server runs at `http://localhost:3001`

2. **Open the frontend**
   Open `FrontEnd/pages/index.html` in your browser (or use a local server like Live Server extension in VS Code)
   You can now login/register normally

## Test Accounts
| Role             | Email                  | Password      |
|------------------|------------------------|---------------|
| Patient          | patient@test.com       | test123       |
| Patient          | mike.wong@email.com    | patient123    |
| Patient          | jane.smith@email.com   | patient123    |
| Caregiver        | dean@mail.com          | dean1234      |
| Caregiver        | bobby@mail.com         | bobby123      |
| Hospital         | dr.chen@sgh.com.sg     | hospital123   |
| Hospital         | dr.lim@sgh.com.sg      | hospital123   |
| Hospital         | hospital@test.com      | hospital123   |
| Hospital Admin   | cgadmin@sgh.com.sg     | admin123      |
| Hospital Admin   | sghadmin@sgh.com.sg    | admin123      |
| System Admin     | sysadmin@privagene.com | admin123      |
| Security Admin   | security@privagene.com | security123   |
| Researcher       | researcher@test.com    | researcher123 |
| Researcher       | george@uow.com         | researcher123 |


## How PSI Works in PrivaGene
PrivaGene uses a Diffie-Hellman based Private Set Intersection protocol to securely compare genetic data.

### The Math
We use a large Sophie Germain prime `P` and its safe prime `Q = (P-1)/2` for modular arithmetic.

### Step-by-Step Process
**1. Patient Blinds Their Genes**
- Patient generates a random secret `a`
- For each gene symbol, compute: `H(gene)^a mod P`
- Send blinded values to backend

**2. Backend Double-Blinds Patient Data & Blinds Disease Genes**
- Backend generates a random secret `b`
- Double-blind patient data: `(H(gene)^a)^b mod P`
- Blind disease genes: `H(disease_gene)^b mod P`
- Send both sets back to patient

**3. Patient Double-Blinds Disease Genes**
- Patient applies their secret `a` to disease genes: `(H(disease_gene)^b)^a mod P`

**4. Compare Sets**
- Patient set: `H(gene)^(ab) mod P`
- Disease set: `H(disease_gene)^(ab) mod P`
- Matching values = matching genes (due to commutativity: `a*b = b*a`)

### Why This is Secure
| Party | What They See | What They Learn |
|-------|---------------|-----------------|
| Patient | Blinded disease genes | Only which of their OWN genes matched |
| Backend | Blinded patient genes | Nothing about patient's actual genes |

- Patient never sees raw disease gene symbols
- Backend never sees raw patient gene symbols
- Only the intersection (matches) is revealed to the patient

### Risk Calculation
Risk % = (matched_genes / total_disease_genes) × constant
Where `constant` is a hospital-defined value where, 0 > `constant` >= 100, representing the weight/severity of the disease.