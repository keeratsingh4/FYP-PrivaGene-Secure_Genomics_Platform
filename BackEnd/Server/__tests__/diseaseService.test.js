const diseaseService = require('../services/diseaseService');
const db = require('../../DBMS/db/db');

jest.mock('../../DBMS/db/db', () => {
  const run = jest.fn();
  const get = jest.fn();
  const all = jest.fn();
  return { run, get, all };
});

describe('diseaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generateHash is deterministic and case-insensitive', () => {
    const hash1 = diseaseService.generateHash('brca1');
    const hash2 = diseaseService.generateHash('BRCA1');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  test('validateConstant enforces >0 and <=100', () => {
    expect(diseaseService.validateConstant(50)).toBe(true);
    expect(diseaseService.validateConstant(0)).toBe(false);
    expect(diseaseService.validateConstant(101)).toBe(false);
  });

  test('createDisease validates constant and inserts disease and genes', async () => {
    db.run.mockResolvedValue({});
    db.get.mockResolvedValue({ id: 'd1' });
    db.all.mockResolvedValue([]);

    const disease = await diseaseService.createDisease({
      hospital_id: 'h1',
      disease_name: 'Cancer',
      disease_code: 'C01',
      description: 'Test',
      constant: 50,
      gene_symbols: ['BRCA1', 'BRCA2'],
    });

    expect(db.run).toHaveBeenCalled();
    expect(disease.id).toBeDefined();
  });

  test('checkDuplicateDisease returns boolean', async () => {
    db.get.mockResolvedValue({ id: 'd1' });
    const dup = await diseaseService.checkDuplicateDisease('h1', 'C01');
    expect(dup).toBe(true);

    db.get.mockResolvedValue(null);
    const notDup = await diseaseService.checkDuplicateDisease('h1', 'C02');
    expect(notDup).toBe(false);
  });

  test('getDiseaseById returns disease with gene symbols', async () => {
    const mockDisease = { id: 'd1', disease_name: 'Cancer', disease_code: 'C01' };
    const mockGenes = [
      { gene_symbol: 'BRCA1', hash_value: 'hash1', gene_id: 'g1' },
      { gene_symbol: 'BRCA2', hash_value: 'hash2', gene_id: 'g2' }
    ];

    db.get.mockResolvedValue(mockDisease);
    db.all.mockResolvedValue(mockGenes);

    const disease = await diseaseService.getDiseaseById('d1');

    expect(db.get).toHaveBeenCalled();
    expect(db.all).toHaveBeenCalled();
    expect(disease).toMatchObject({ id: 'd1', disease_name: 'Cancer' });
    expect(disease.gene_symbols).toEqual(['BRCA1', 'BRCA2']);
    expect(disease.gene_details).toHaveLength(2);
  });

  test('getDiseaseById returns null when disease not found', async () => {
    db.get.mockResolvedValue(null);

    const disease = await diseaseService.getDiseaseById('nonexistent');

    expect(disease).toBeNull();
  });

  test('updateDisease updates disease metadata', async () => {
    const existingDisease = {
      id: 'd1',
      disease_name: 'Old Name',
      disease_code: 'C01',
      hospital_id: 'h1'
    };
    const mockGenes = [{ gene_symbol: 'BRCA1', hash_value: 'hash1', gene_id: 'g1' }];

    db.get.mockResolvedValueOnce(existingDisease); // For getDiseaseById check
    db.get.mockResolvedValueOnce(existingDisease); // For final getDiseaseById
    db.all.mockResolvedValue(mockGenes);
    db.run.mockResolvedValue({});

    const updated = await diseaseService.updateDisease('d1', {
      disease_name: 'New Name',
      description: 'Updated description'
    });

    expect(db.run).toHaveBeenCalled();
    expect(updated).toBeDefined();
  });

  test('updateDisease validates constant when updating', async () => {
    const existingDisease = { id: 'd1', hospital_id: 'h1' };
    db.get.mockResolvedValue(existingDisease);
    db.all.mockResolvedValue([]);
    db.run.mockResolvedValue({});

    await expect(
      diseaseService.updateDisease('d1', { constant: 150 })
    ).rejects.toThrow('Constant must be a number greater than 0 and less than or equal to 100');
  });

  test('updateDisease updates gene symbols when provided', async () => {
    const existingDisease = { id: 'd1', hospital_id: 'h1' };
    db.get.mockResolvedValue(existingDisease);
    db.all.mockResolvedValue([]);
    db.run.mockResolvedValue({});

    await diseaseService.updateDisease('d1', {
      gene_symbols: ['TP53', 'BRCA1']
    });

    // Should delete old genes and insert new ones
    const deleteCall = db.run.mock.calls.find(call => 
      call[0].includes('DELETE FROM disease_genes')
    );
    expect(deleteCall).toBeDefined();
  });

  test('deleteDisease returns false when disease not found', async () => {
    db.get.mockResolvedValue(null);

    const result = await diseaseService.deleteDisease('nonexistent');

    expect(result).toBe(false);
  });

  test('deleteDisease deletes disease when found', async () => {
    const existingDisease = { id: 'd1', disease_name: 'Cancer' };
    db.get.mockResolvedValue(existingDisease);
    db.run.mockResolvedValue({});

    const result = await diseaseService.deleteDisease('d1');

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM diseases'),
      ['d1']
    );
    expect(result).toBe(true);
  });

  test('bulkInsertDiseases inserts valid entries', async () => {
    db.get.mockResolvedValue(null); // No existing disease
    db.run.mockResolvedValue({});

    const entries = [
      {
        disease_name: 'Cancer A',
        disease_code: 'C01',
        gene_symbol: 'BRCA1',
        description: 'Test',
        constant: '50'
      },
      {
        disease_name: 'Cancer B',
        disease_code: 'C02',
        gene_symbol: 'TP53',
        constant: '75'
      }
    ];

    const result = await diseaseService.bulkInsertDiseases(entries, 'h1');

    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(0);
    expect(db.run).toHaveBeenCalled();
  });

  test('bulkInsertDiseases skips entries with missing required fields', async () => {
    db.get.mockResolvedValue(null);
    db.run.mockResolvedValue({});

    const entries = [
      {
        disease_name: 'Cancer A',
        disease_code: 'C01',
        gene_symbol: 'BRCA1',
        constant: '50'
      },
      {
        disease_name: '', // Missing required field
        disease_code: 'C02',
        gene_symbol: 'TP53'
      }
    ];

    const result = await diseaseService.bulkInsertDiseases(entries, 'h1');

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  test('bulkInsertDiseases skips entries with invalid constant', async () => {
    db.get.mockResolvedValue(null);
    db.run.mockResolvedValue({});

    const entries = [
      {
        disease_name: 'Cancer A',
        disease_code: 'C01',
        gene_symbol: 'BRCA1',
        constant: '150' // Invalid (> 100)
      }
    ];

    const result = await diseaseService.bulkInsertDiseases(entries, 'h1');

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0].reason).toContain('Invalid constant value');
  });

  test('bulkInsertDiseases handles existing diseases by reusing ID', async () => {
    const existingDisease = { id: 'existing-disease-id', description: 'Existing' };
    db.get
      .mockResolvedValueOnce(existingDisease) // Disease exists
      .mockResolvedValueOnce(null); // Gene doesn't exist
    db.run.mockResolvedValue({});

    const entries = [
      {
        disease_name: 'Cancer A',
        disease_code: 'C01',
        gene_symbol: 'BRCA1',
        constant: '50'
      }
    ];

    const result = await diseaseService.bulkInsertDiseases(entries, 'h1');

    expect(result.inserted).toBe(1);
    // Should check for existing disease first
    expect(db.get).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id'),
      ['h1', 'C01']
    );
  });

  test('bulkInsertDiseases skips duplicate gene symbols', async () => {
    db.get
      .mockResolvedValueOnce(null) // Disease doesn't exist
      .mockResolvedValueOnce({ id: 'g1' }); // Gene already exists
    db.run.mockResolvedValue({});

    const entries = [
      {
        disease_name: 'Cancer A',
        disease_code: 'C01',
        gene_symbol: 'BRCA1',
        constant: '50'
      }
    ];

    const result = await diseaseService.bulkInsertDiseases(entries, 'h1');

    expect(result.skipped).toBe(1);
    expect(result.errors[0].reason).toContain('Duplicate gene symbol');
  });
});




