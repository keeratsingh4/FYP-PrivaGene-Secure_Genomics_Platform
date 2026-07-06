const encryptionService = require('../services/encryptionService');
const crypto = require('crypto');

describe('encryptionService', () => {
  test('encrypt returns encrypted string in iv:data format', () => {
    const plaintext = 'test data';
    const encrypted = encryptionService.encrypt(plaintext);
    
    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe('string');
    expect(encrypted).toContain(':'); // Should have IV:data format
    expect(encrypted.split(':')).toHaveLength(2);
  });

  test('decrypt correctly decrypts encrypted data', () => {
    const plaintext = 'sensitive information';
    const encrypted = encryptionService.encrypt(plaintext);
    const decrypted = encryptionService.decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  test('encrypt returns null for null/undefined input', () => {
    expect(encryptionService.encrypt(null)).toBeNull();
    expect(encryptionService.encrypt(undefined)).toBeNull();
  });

  test('decrypt returns null for null/undefined input', () => {
    expect(encryptionService.decrypt(null)).toBeNull();
    expect(encryptionService.decrypt(undefined)).toBeNull();
  });

  test('encrypt handles objects by converting to JSON string', () => {
    const obj = { key: 'value', number: 123 };
    const encrypted = encryptionService.encrypt(obj);
    const decrypted = encryptionService.decrypt(encrypted);
    
    expect(JSON.parse(decrypted)).toEqual(obj);
  });

  test('decrypt handles legacy unencrypted data (no colon)', () => {
    const legacyData = 'plain text value';
    const result = encryptionService.decrypt(legacyData);
    
    expect(result).toBe(legacyData);
  });

  test('decrypt handles non-string types (legacy data)', () => {
    const legacyNumber = 123;
    const result = encryptionService.decrypt(legacyNumber);
    
    expect(result).toBe('123');
  });

  test('encryptJSON encrypts and decrypts JSON objects', () => {
    const obj = { genes: ['BRCA1', 'BRCA2'], count: 2 };
    const encrypted = encryptionService.encryptJSON(obj);
    const decrypted = encryptionService.decryptJSON(encrypted);
    
    expect(decrypted).toEqual(obj);
  });

  test('encryptJSON returns null for null input', () => {
    expect(encryptionService.encryptJSON(null)).toBeNull();
  });

  test('decryptJSON returns null for null input', () => {
    expect(encryptionService.decryptJSON(null)).toBeNull();
  });

  test('decryptJSON handles legacy unencrypted JSON strings', () => {
    const legacyJSON = '["BRCA1", "BRCA2"]';
    const result = encryptionService.decryptJSON(legacyJSON);
    
    expect(result).toEqual(['BRCA1', 'BRCA2']);
  });

  test('encryptNumber encrypts and decrypts numbers', () => {
    const number = 75.5;
    const encrypted = encryptionService.encryptNumber(number);
    const decrypted = encryptionService.decryptNumber(encrypted);
    
    expect(decrypted).toBe(number);
  });

  test('encryptNumber returns null for null/undefined', () => {
    expect(encryptionService.encryptNumber(null)).toBeNull();
    expect(encryptionService.encryptNumber(undefined)).toBeNull();
  });

  test('decryptNumber returns null for null/undefined', () => {
    expect(encryptionService.decryptNumber(null)).toBeNull();
    expect(encryptionService.decryptNumber(undefined)).toBeNull();
  });

  test('decryptNumber handles legacy unencrypted numbers', () => {
    const legacyNumber = 50;
    const result = encryptionService.decryptNumber(legacyNumber);
    
    expect(result).toBe(50);
  });

  test('decryptNumber handles invalid encrypted data gracefully', () => {
    const invalid = 'not:a:valid:encrypted:format';
    const result = encryptionService.decryptNumber(invalid);
    
    // Should return null or handle gracefully
    expect(result === null || typeof result === 'number' || isNaN(result)).toBe(true);
  });

  test('encrypt produces different output for same input (due to random IV)', () => {
    const plaintext = 'same input';
    const encrypted1 = encryptionService.encrypt(plaintext);
    const encrypted2 = encryptionService.encrypt(plaintext);
    
    // Should be different due to random IV
    expect(encrypted1).not.toBe(encrypted2);
    
    // But both should decrypt to same value
    expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
    expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
  });

  test('encryptJSON handles arrays correctly', () => {
    const array = ['BRCA1', 'BRCA2', 'TP53'];
    const encrypted = encryptionService.encryptJSON(array);
    const decrypted = encryptionService.decryptJSON(encrypted);
    
    expect(decrypted).toEqual(array);
  });

  test('decryptNumber parses float values correctly', () => {
    const floatValue = 87.123;
    const encrypted = encryptionService.encryptNumber(floatValue);
    const decrypted = encryptionService.decryptNumber(encrypted);
    
    expect(decrypted).toBeCloseTo(floatValue, 3);
  });
});

