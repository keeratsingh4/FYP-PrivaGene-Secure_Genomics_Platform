// encryptionService.js
// Service for encrypting/decrypting sensitive data in the database

const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-min-32-chars-long-change-this-in-production!!';
const ALGORITHM = 'aes-256-cbc';

// Ensure key is exactly 32 bytes for AES-256
const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

const encryptionService = {
    /**
     * Encrypt a string value
     * @param {string} text - Plain text to encrypt
     * @returns {string} - Encrypted text in format: iv:encryptedData
     */
    encrypt(text) {
        if (!text) return null;

        try {
            // Convert to string if it's an object/array
            const plainText = typeof text === 'object' ? JSON.stringify(text) : String(text);

            // Generate a random initialization vector for each encryption
            const iv = crypto.randomBytes(16);

            // Create cipher
            const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

            // Encrypt the data
            let encrypted = cipher.update(plainText, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            // Return IV + encrypted data (need IV for decryption)
            return iv.toString('hex') + ':' + encrypted;
        } catch (err) {
            console.error('Encryption error:', err);
            throw new Error('Failed to encrypt data');
        }
    },

    /**
     * Decrypt an encrypted string
     * @param {string} encryptedText - Encrypted text in format: iv:encryptedData
     * @returns {string} - Decrypted plain text
     */
    decrypt(encryptedText) {
        if (!encryptedText) return null;

        try {
            // BUGFIX: Handle non-string types (legacy unencrypted data)
            if (typeof encryptedText !== 'string') {
                return String(encryptedText); // Return as-is, converted to string
            }

            // BUGFIX: Check if data looks encrypted (has iv:data format)
            if (!encryptedText.includes(':')) {
                return encryptedText; // Return as-is (legacy unencrypted data)
            }

            // Split IV and encrypted data
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                return encryptedText; 
            }

            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];

            // Create decipher
            const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

            // Decrypt the data
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (err) {
            console.error('Decryption error:', err);
            // Return original value - allows graceful degradation
            return String(encryptedText);
        }
    },

    /**
     * Encrypt a JSON object (like matched_genes array)
     * @param {Object|Array} obj - Object or array to encrypt
     * @returns {string} - Encrypted JSON string
     */
    encryptJSON(obj) {
        if (!obj) return null;
        return this.encrypt(JSON.stringify(obj));
    },

    /**
     * Decrypt JSON string back to object/array
     * @param {string} encryptedJSON - Encrypted JSON string
     * @returns {Object|Array} - Decrypted object or array
     */
    decryptJSON(encryptedJSON) {
        if (!encryptedJSON) return null;

        try {
            const decrypted = this.decrypt(encryptedJSON);
            return JSON.parse(decrypted);
        } catch (err) {
            console.error('JSON decryption error:', err);
            // BUGFIX: Try to return as-is if it's already valid JSON
            try {
                return JSON.parse(encryptedJSON);
            } catch {
                return null;
            }
        }
    },

    /**
     * Encrypt a numeric value
     * @param {number} num - Number to encrypt
     * @returns {string} - Encrypted number as string
     */
    encryptNumber(num) {
        if (num === null || num === undefined) return null;
        return this.encrypt(String(num));
    },

    /**
     * Decrypt to numeric value
     * @param {string} encryptedNum - Encrypted number string
     * @returns {number} - Decrypted number
     */
    decryptNumber(encryptedNum) {
        if (!encryptedNum) return null;

        // Handle case where value is already a number (legacy data)
        if (typeof encryptedNum === 'number') {
            return encryptedNum;
        }

        const decrypted = this.decrypt(encryptedNum);
        const num = parseFloat(decrypted);
        
        // Validate the result
        if (isNaN(num)) {
            return null;
        }
        
        return num;
    }
};

module.exports = encryptionService;