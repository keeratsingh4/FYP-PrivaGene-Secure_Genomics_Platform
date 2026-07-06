const psiService = require('../services/psiService');

describe('psiService', () => {
  test('hashItem returns BigInt modulo Q', () => {
    const v = psiService.hashItem('BRCA1');
    expect(typeof v).toBe('bigint');
  });

  test('modExp computes power modulo', () => {
    const base = 5n;
    const exp = 3n;
    const mod = 13n;
    const result = psiService.modExp(base, exp, mod);
    expect(result).toBe(8n); // 5^3 = 125, 125 % 13 = 8
  });

  test('compute returns blinded sets', () => {
    const blindedPatient = ['12345678901234567890'];
    const diseaseGenes = ['BRCA1', 'BRCA2'];

    const result = psiService.compute(blindedPatient, diseaseGenes);

    expect(Array.isArray(result.blinded_disease)).toBe(true);
    expect(Array.isArray(result.double_blinded_patient)).toBe(true);
    expect(result.blinded_disease.length).toBe(2);
    expect(result.double_blinded_patient.length).toBe(1);
  });
});




