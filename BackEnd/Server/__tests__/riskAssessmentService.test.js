const riskAssessmentService = require('../services/riskAssessmentService');
const encryptionService = require('../services/encryptionService');
const db = require('../../DBMS/db/db');

jest.mock('../../DBMS/db/db', () => {
  const run = jest.fn();
  const get = jest.fn();
  const all = jest.fn();
  return { run, get, all };
});

jest.mock('../services/encryptionService', () => ({
  encryptNumber: jest.fn(v => `enc:${v}`),
  encryptJSON: jest.fn(v => `encjson:${JSON.stringify(v)}`),
  decryptNumber: jest.fn(v => Number(String(v).replace('enc:', ''))),
  decryptJSON: jest.fn(v => {
    const raw = String(v).replace('encjson:', '');
    return JSON.parse(raw);
  }),
}));

describe('riskAssessmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createAssessment encrypts fields and inserts row', async () => {
    db.run.mockResolvedValue({});

    const assessment = await riskAssessmentService.createAssessment({
      userId: 'user1',
      overallRisk: 80,
      diseaseId: 'd1',
      matchCount: 5,
      matchedGenes: ['BRCA1'],
      riskPercentage: 75,
    });

    expect(db.run).toHaveBeenCalled();
    expect(assessment).toMatchObject({
      userId: 'user1',
      overallRisk: 80,
      diseaseId: 'd1',
      matchCount: 5,
      matchedGenes: ['BRCA1'],
      riskPercentage: 75,
    });
  });

  test('getAssessmentsByUser decrypts stored fields', async () => {
    db.all.mockResolvedValue([
      {
        id: 'a1',
        userId: 'user1',
        overallRisk: 'enc:80',
        diseaseId: 'd1',
        matchCount: 5,
        matchedGenes: 'encjson:["BRCA1"]',
        riskPercentage: 'enc:75',
        createdAt: '2024-01-01',
      },
    ]);

    const result = await riskAssessmentService.getAssessmentsByUser('user1');
    expect(result[0]).toMatchObject({
      id: 'a1',
      overallRisk: 80,
      matchedGenes: ['BRCA1'],
      riskPercentage: 75,
    });
  });

  test('getAssessmentById decrypts single assessment', async () => {
    db.get.mockResolvedValue({
      id: 'a1',
      userId: 'user1',
      overallRisk: 'enc:80',
      diseaseId: 'd1',
      matchCount: 5,
      matchedGenes: 'encjson:["BRCA1"]',
      riskPercentage: 'enc:75',
      createdAt: '2024-01-01',
    });

    const result = await riskAssessmentService.getAssessmentById('a1');
    expect(result).toMatchObject({
      id: 'a1',
      overallRisk: 80,
      matchedGenes: ['BRCA1'],
      riskPercentage: 75,
    });
  });

  test('deleteAssessment returns boolean based on db.run changes', async () => {
    db.run.mockResolvedValue({ changes: 1 });
    const deleted = await riskAssessmentService.deleteAssessment('a1');
    expect(deleted).toBe(true);

    db.run.mockResolvedValue({ changes: 0 });
    const notDeleted = await riskAssessmentService.deleteAssessment('a2');
    expect(notDeleted).toBe(false);
  });
});




