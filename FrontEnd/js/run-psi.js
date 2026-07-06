// =============================================================
// PRIVAGENE - CLIENT-SIDE PSI (Private Set Intersection)
// Privacy-preserving disease risk computation
// =============================================================

// Sophie Germain prime for PSI (same as backend)
const PSI_P = BigInt("0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
                     "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
                     "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
                     "E485B576625E7EC6F44C42E9A63A36210000000000090563");

const PSI_Q = (PSI_P - 1n) / 2n;

// =============================================================
// Utility Functions
// =============================================================

/**
 * Hash string to BigInt using SHA-256
 * @param {string} str - String to hash
 * @returns {Promise<BigInt>} Hash as BigInt
 */
async function sha256ToBigInt(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const byteArray = new Uint8Array(hashBuffer);

    let hex = "";
    for (const b of byteArray) {
        hex += b.toString(16).padStart(2, "0");
    }

    return BigInt("0x" + hex);
}

/**
 * Fast modular exponentiation
 * @param {BigInt} base - Base
 * @param {BigInt} exp - Exponent
 * @param {BigInt} mod - Modulus
 * @returns {BigInt} Result of base^exp mod mod
 */
function modExp(base, exp, mod) {
    base = base % mod;
    let result = 1n;
    while (exp > 0n) {
        if (exp & 1n) result = (result * base) % mod;
        base = (base * base) % mod;
        exp >>= 1n;
    }
    return result;
}

/**
 * Generate secure random BigInt secret
 * @param {BigInt} mod - Modulus
 * @returns {BigInt} Random secret
 */
function randomSecret(mod) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);

    let hex = "";
    for (const b of bytes) {
        hex += b.toString(16).padStart(2, "0");
    }

    return (BigInt("0x" + hex) % (mod - 2n)) + 2n;
}

// =============================================================
// MAIN PSI FUNCTION
// =============================================================

/**
 * Run Private Set Intersection computation
 * @param {string} selectedDiseaseID - Disease ID
 * @returns {Promise<Object>} PSI results with match count and risk percentage
 */
async function runPSI(selectedDiseaseID) {
    console.log("PSI: Starting runPSI()");
    console.log("Selected disease ID:", selectedDiseaseID);

    // Load patient genes from browser storage
    const patientGenes = JSON.parse(localStorage.getItem("mappedGeneSymbols") || "[]");
    
    if (patientGenes.length === 0) {
        throw new Error("No patient genes found. Please upload your genetic data first.");
    }
    
    console.log("Patient genes loaded:", patientGenes.length, "genes");

    // Generate patient secret 'a'
    const a = randomSecret(PSI_Q);
    console.log("Patient secret 'a' generated");

    // Blind patient genes → h^a mod P
    const blindedPatient = [];
    for (const gene of patientGenes) {
        const h = await sha256ToBigInt(gene);
        const hReduced = h % PSI_Q;
        const blinded = modExp(hReduced, a, PSI_P);
        blindedPatient.push(blinded.toString());
    }

    console.log("Blinded patient genes (h^a mod P):", blindedPatient.length, "values");

    // Send blinded data to backend
    console.log("Sending blinded data to backend...");
    
    const backendURL = (typeof Config !== 'undefined' && Config.backend) ? Config.backend.baseURL : 'http://localhost:3001';
    
    const response = await fetch(`${backendURL}/api/backend_psi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            blinded_patient: blindedPatient,
            disease: selectedDiseaseID
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "PSI computation failed on backend");
    }

    const backendResult = await response.json();
    console.log("Backend returned:");
    console.log("   - Double-blinded patient values:", backendResult.double_blinded_patient.length);
    console.log("   - Blinded disease values:", backendResult.blinded_disease.length);

    // Double-blind disease genes with patient secret 'a' → (h^b)^a mod P
    const doubleBlindedDisease = backendResult.blinded_disease.map(
        item => modExp(BigInt(item), a, PSI_P).toString()
    );

    console.log("Double-blinded disease genes (h^b)^a mod P:", doubleBlindedDisease.length, "values");

    // Compare double-blinded values to find matches
    const patientAB = backendResult.double_blinded_patient.map(x => x.toString());
    const diseaseABSet = new Set(doubleBlindedDisease);

    const matches = [];
    patientAB.forEach((val, i) => {
        if (diseaseABSet.has(val)) {
            matches.push(patientGenes[i]);
        }
    });

    console.log("PSI Matches found:", matches);
    console.log("Match count:", matches.length);


    // Compute risk percentage using backend (with disease constant)
    const riskPercentage = await computePSIRiskPercentage(selectedDiseaseID, matches, doubleBlindedDisease);
    console.log("Risk percentage:", riskPercentage.toFixed(2) + "%");

    return {
            matchCount: matches.length,
            matches,
            riskPercentage
        };
}

/**
 * Compute PSI risk percentage using backend
 * Calls backend to calculate: |matchedCount / totalDiseaseGenes| * constant
 * @param {string} diseaseId - Disease ID to get constant from
 * @param {Array<string>} matchedList - List of matched gene symbols
 * @param {Array<string>} doubleBlindedDiseaseList - Double-blinded disease genes
 * @returns {Promise<number>} Risk percentage
 */
async function computePSIRiskPercentage(diseaseId, matchedList, doubleBlindedDiseaseList) {
    // If no disease genes, return 0
    if (doubleBlindedDiseaseList.length === 0) {
        return 0;
    }

    try {
        console.log("Calculating risk percentage via backend...");
        console.log("  - Disease ID:", diseaseId);
        console.log("  - Matched count:", matchedList.length);
        console.log("  - Total disease genes:", doubleBlindedDiseaseList.length);

        const backendURL = (typeof Config !== 'undefined' && Config.backend) ? Config.backend.baseURL : 'http://localhost:3001';

        const response = await fetch(`${backendURL}/api/psi/calculate-risk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                diseaseId: diseaseId,
                matchedCount: matchedList.length,
                totalDiseaseGenes: doubleBlindedDiseaseList.length
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Risk calculation failed:", error);
            // Fallback to local calculation without constant
            console.log("Falling back to local calculation...");
            return (matchedList.length / doubleBlindedDiseaseList.length) * 100;
        }

        const result = await response.json();
        console.log("Backend risk calculation result:", result);

        return result.riskPercentage;

    } catch (error) {
        console.error("Error calling risk calculation endpoint:", error);
        // Fallback to local calculation without constant
        console.log("Falling back to local calculation...");
        return (matchedList.length / doubleBlindedDiseaseList.length) * 100;
    }
}

// Make runPSI globally accessible
window.runPSI = runPSI;
