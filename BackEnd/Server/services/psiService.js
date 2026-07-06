// psiService.js
const crypto = require('crypto');

// Public P value
const PSI_P = BigInt("0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
                     "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
                     "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
                     "E485B576625E7EC6F44C42E9A63A36210000000000090563");

const PSI_Q = (PSI_P - 1n) / 2n;

const psiService = {
  // Generate random secret
  randomSecret(mod) {
    const bytes = crypto.randomBytes(32);
    const hex = bytes.toString('hex');
    return (BigInt('0x' + hex) % (mod - 2n)) + 2n;
  },

  // Hash item and reduce mod Q
  hashItem(gene) {
    const hash = crypto.createHash('sha256').update(gene).digest('hex');
    const h = BigInt('0x' + hash);
    return h % PSI_Q;  // Reduce mod Q
  },

  // Fast modular exponentiation
  modExp(base, exp, mod) {
    base = base % mod;
    let result = 1n;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % mod;
      base = (base * base) % mod;
      exp >>= 1n;
    }
    return result;
  },

  // Main compute() method
  compute(blindedPatientList, diseaseGeneId) {
    console.log(`PSI Service: compute() called`);
    console.log(`Received ${blindedPatientList.length} blinded patient values`);
    
    // Generate server secret b (new secret each time)
    const b = this.randomSecret(PSI_Q);
    console.log(`Server secret b generated`);
    
    // 1. Blind disease genes (h^b mod P)
    const blindedDisease = [];
    const diseaseGeneList = diseaseGeneId; // diseaseGeneId is actually the gene array now
    
    console.log(`Disease has ${diseaseGeneList.length} genes`);
    
    for (const g of diseaseGeneList) {
      const h = this.hashItem(g);
      const blinded = this.modExp(h, b, PSI_P);
      blindedDisease.push(blinded);
    }

    console.log(`Blinded ${blindedDisease.length} disease genes`);

    // 2. Double-blind patient ( (h^a)^b mod P )
    const doubleBlindedPatient = blindedPatientList.map(v => {
      return this.modExp(BigInt(v), b, PSI_P);
    });

    console.log(`Double-blinded ${doubleBlindedPatient.length} patient genes`);

    // Return as strings
    const result = {
      blinded_disease: blindedDisease.map(x => x.toString()),
      double_blinded_patient: doubleBlindedPatient.map(x => x.toString())
    };

    console.log(`PSI compute() completed successfully`);
    
    return result;
  }
};

module.exports = psiService;