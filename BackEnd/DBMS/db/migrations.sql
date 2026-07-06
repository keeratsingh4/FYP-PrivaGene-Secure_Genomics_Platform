-- ===================================
-- Users Table
-- ===================================
-- users table: stores user registration and login information
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  date_of_birth TEXT,
  address TEXT,
  organization_name TEXT,
  organization_id TEXT,
  license_number TEXT,
  specialty TEXT,
  institution TEXT,
  research_area TEXT,
  research_consent INTEGER DEFAULT 0,  -- NEW: 0 = no consent, 1 = consented
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,                     -- NEW: Timestamp when user was soft deleted
  deletion_reason TEXT                 -- NEW: Reason for deletion
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_research_consent ON users(research_consent);  -- NEW: Index for filtering consented users
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);              -- NEW: Index for soft delete queries

-- Add research_consent column to existing users table if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle this gracefully
-- This will fail silently if column already exists when run through migrations
-- ALTER TABLE users ADD COLUMN research_consent INTEGER DEFAULT 0;

-- documents table: stores metadata only (no sensitive genetic data)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  checksum_hash TEXT,
  size_bytes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);


-- ===================================
-- SEED DISEASES FOR TEST USERS
-- ===================================

-- Insert default system admin user (if not exists)
INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name, 
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'sysadmin_default',
    'sysadmin@privagene.com',
    '$2b$10$nfdXaqhn3Ecuh0GR9Z3dsuCPN88AGhDvHhFmODmJhHYI4.97XnjqO',
    'system_admin',
    'System',
    'Administrator',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

-- Insert default security admin user (if not exists)
INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name, 
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'secadmin_default',
    'security@privagene.com',
    '$2b$10$tYCHManNeoT5pbN7NwKc3.A1RSsJfFtdW0UOoGKDae7REKSI/Kce6',
    'security_admin',
    'Security',
    'Administrator',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

-- Insert test patient user (with research consent)
INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    date_of_birth,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'patient_test_1',
    'patient@test.com',
    '$2b$10$HAcdXOtRSARIPl4RH8Ed1.GpN93fuqkIoe00O6oduIMAOT.QogV5u',
    'patient',
    'Test',
    'Patient',
    '1989-09-23',
    'active',
    1,
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    date_of_birth,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'patient_test_2',
    'john.doe@email.com',
    '$2b$10$fKsGO9lFa4l70xK0/6R5ru6wD5Xl3AZIZPLGS2FpbKRz.KW5L2JG2',
    'patient',
    'John',
    'Doe',
    '2004-02-10',
    'active',
    1,
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    date_of_birth,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'patient_test_3',
    'jane.smith@email.com',
    '$2b$10$fKsGO9lFa4l70xK0/6R5ru6wD5Xl3AZIZPLGS2FpbKRz.KW5L2JG2',
    'patient',
    'Jane',
    'Smith',
    '1995-12-03',
    'active',
    1,
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    date_of_birth,
    phone,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'patient_test_4',
    'mike.wong@email.com',
    '$2b$10$fKsGO9lFa4l70xK0/6R5ru6wD5Xl3AZIZPLGS2FpbKRz.KW5L2JG2',
    'patient',
    'Mike',
    'Wong',
    '1985-09-23',
    '99995555',
    'active',
    1,
    datetime('now'),
    datetime('now')
);

-- Insert test hospital user
INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    phone,
    organization_name,
    license_number,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'hospital_test_1',
    'hospital@test.com',
    '$2b$10$ZMQQBBus/20D3Bvcc8h9D.XIQ4q/6uofwWScS455Jb18XZDKHZohK',
    'hospital',
    'Test',
    'Hospital',
    '+ 65 88886666',
    'City General Hospital',
    'LIC123456',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    organization_name,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'hospital_admin_1',
    'cghadmin@sgh.com.sg',
    '$2b$10$nfdXaqhn3Ecuh0GR9Z3dsuCPN88AGhDvHhFmODmJhHYI4.97XnjqO',
    'hospital_admin',
    'City General Hospital',
    'active',
    0,
    datetime('now'),
    datetime('now')
);


INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    organization_name,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'hospital_admin_2',
    'sghadmin@sgh.com.sg',
    '$2b$10$nfdXaqhn3Ecuh0GR9Z3dsuCPN88AGhDvHhFmODmJhHYI4.97XnjqO',
    'hospital_admin',
    'Singapore General Hospital',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    phone,
    organization_name,
    license_number,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'hospital_test_2',
    'dr.chen@sgh.com.sg',
    '$2b$10$ZMQQBBus/20D3Bvcc8h9D.XIQ4q/6uofwWScS455Jb18XZDKHZohK',
    'hospital',
    'Test',
    'Hospital',
    '+65 91234567',
    'Singapore General Hospital',
    'LIC654321',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    phone,
    organization_name,
    license_number,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'hospital_test_3',
    'dr.wong@sgh.com.sg',
    '$2b$10$ZMQQBBus/20D3Bvcc8h9D.XIQ4q/6uofwWScS455Jb18XZDKHZohK',
    'hospital',
    'Bob',
    'Wong',
    '+65 92345678',
    'Singapore General Hospital',
    'LIC654555',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

-- Insert test researcher user
INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name, 
    institution,
    research_area,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'researcher_test_1',
    'researcher@test.com',
    '$2b$10$4a6yX8/KQGF/gllTtjnfdOO7c3CozwIE/4J.8SxkH1W5AFEGCKb2m',
    'researcher',
    'Test',
    'Researcher',
    'Research University',
    'Genomics',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

-- ===================================
-- Risk Assessments Table
-- ===================================
-- risk_assessments table: stores patient risk assessment results
CREATE TABLE IF NOT EXISTS risk_assessments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  overall_risk REAL NOT NULL,
  disease_id TEXT,
  match_count INTEGER,
  matched_genes TEXT,
  risk_percentage REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_user ON risk_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_created ON risk_assessments(created_at DESC);

-- ===================================
-- Diseases Table
-- ===================================
-- diseases table: stores disease records for hospital PSI (renamed from gene_entries)
CREATE TABLE IF NOT EXISTS diseases (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL,
  disease_name TEXT NOT NULL,
  disease_code TEXT NOT NULL,
  description TEXT,
  constant REAL NOT NULL DEFAULT 50.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diseases_hospital ON diseases(hospital_id);
CREATE INDEX IF NOT EXISTS idx_diseases_disease_code ON diseases(disease_code);
CREATE INDEX IF NOT EXISTS idx_diseases_created ON diseases(created_at DESC);

-- disease_genes table: stores individual gene symbols linked to a disease
CREATE TABLE IF NOT EXISTS disease_genes (
  id TEXT PRIMARY KEY,
  disease_id TEXT NOT NULL, -- Foreign key linking to diseases (renamed from gene_entry_id)
  gene_symbol TEXT NOT NULL,
  hash_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  -- Ensures that a specific gene symbol is not duplicated for the same disease
  UNIQUE (disease_id, gene_symbol), 
  
  FOREIGN KEY (disease_id) REFERENCES diseases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_disease_genes_disease_id ON disease_genes(disease_id);
CREATE INDEX IF NOT EXISTS idx_disease_genes_symbol ON disease_genes(gene_symbol);
CREATE INDEX IF NOT EXISTS idx_disease_genes_hash ON disease_genes(hash_value);

-- ===================================
-- SEED DISEASES FOR TEST HOSPITAL
-- ===================================

-- Disease 1: Breast Cancer
INSERT OR IGNORE INTO diseases (
    id,
    hospital_id,
    disease_name,
    disease_code,
    description,
    constant,
    created_at,
    updated_at
) VALUES (
    'disease_breast_cancer_1',
    'hospital_test_1',
    'Breast Cancer',
    'BRCA-2024',
    'Hereditary breast cancer associated with BRCA1 and BRCA2 mutations',
    75.0,
    datetime('now'),
    datetime('now')
);

-- Disease 1 Genes
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_brca1_1', 'disease_breast_cancer_1', 'BRCA1', 
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_brca2_1', 'disease_breast_cancer_1', 'BRCA2', 
        'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_tp53_1', 'disease_breast_cancer_1', 'TP53', 
        'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', datetime('now'), datetime('now'));


-- Disease 2: Type 2 Diabetes
INSERT OR IGNORE INTO diseases (
    id,
    hospital_id,
    disease_name,
    disease_code,
    description,
    constant,
    created_at,
    updated_at
) VALUES (
    'disease_diabetes_1',
    'hospital_test_1',
    'Type 2 Diabetes',
    'T2D-2024',
    'Genetic risk factors for type 2 diabetes mellitus',
    60.0,
    datetime('now'),
    datetime('now')
);

-- Disease 2 Genes
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_tcf7l2_1', 'disease_diabetes_1', 'TCF7L2', 
        'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pparg_1', 'disease_diabetes_1', 'PPARG', 
        'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_fto_1', 'disease_diabetes_1', 'FTO', 
        'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_kcnj11_1', 'disease_diabetes_1', 'KCNJ11', 
        'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', datetime('now'), datetime('now'));


-- Disease 3: Alzheimer's Disease
INSERT OR IGNORE INTO diseases (
    id,
    hospital_id,
    disease_name,
    disease_code,
    description,
    constant,
    created_at,
    updated_at
) VALUES (
    'disease_alzheimers_1',
    'hospital_test_1',
    'Alzheimer''s Disease',
    'ALZ-2024',
    'Genetic predisposition markers for late-onset Alzheimer''s disease',
    80.0,
    datetime('now'),
    datetime('now')
);

-- Disease 3 Genes
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_apoe_1', 'disease_alzheimers_1', 'APOE', 
        'd77e33d56f7a3e7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_psen1_1', 'disease_alzheimers_1', 'PSEN1', 
        'e88f44e67a8b4f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_psen2_1', 'disease_alzheimers_1', 'PSEN2', 
        'f99a55f78b9c5a9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_app_1', 'disease_alzheimers_1', 'APP', 
        'a00b66a89c0d6b0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e', datetime('now'), datetime('now'));


-- Disease 4: Cardiovascular Disease
INSERT OR IGNORE INTO diseases (
    id,
    hospital_id,
    disease_name,
    disease_code,
    description,
    constant,
    created_at,
    updated_at
) VALUES (
    'disease_cardiovascular_1',
    'hospital_test_1',
    'Cardiovascular Disease',
    'CVD-2024',
    'Genetic markers associated with heart disease and stroke risk',
    65.0,
    datetime('now'),
    datetime('now')
);

-- Disease 4 Genes
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_apoe_2', 'disease_cardiovascular_1', 'APOE', 
        'd77e33d56f7a3e7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_mthfr_1', 'disease_cardiovascular_1', 'MTHFR', 
        'b11c77b90d1e7c1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ace_1', 'disease_cardiovascular_1', 'ACE', 
        'c22d88c01e2f8d2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ldlr_1', 'disease_cardiovascular_1', 'LDLR', 
        'd33e99d12f3a9e3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pcsk9_1', 'disease_cardiovascular_1', 'PCSK9', 
        'e44f00e23a4b0f4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c', datetime('now'), datetime('now'));


-- Disease 5: Lung Cancer
INSERT OR IGNORE INTO diseases (
    id,
    hospital_id,
    disease_name,
    disease_code,
    description,
    constant,
    created_at,
    updated_at
) VALUES (
    'disease_lung_cancer_1',
    'hospital_test_1',
    'Lung Cancer',
    'LUNG-2024',
    'Genetic susceptibility markers for lung cancer development',
    70.0,
    datetime('now'),
    datetime('now')
);

-- Disease 5 Genes
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_egfr_1', 'disease_lung_cancer_1', 'EGFR', 
        'f55a11f34b5c1a5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_kras_1', 'disease_lung_cancer_1', 'KRAS', 
        'a66b22a45c6d2b6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alk_1', 'disease_lung_cancer_1', 'ALK', 
        'b77c33b56d7e3c7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_tp53_2', 'disease_lung_cancer_1', 'TP53', 
        'c00d66c89e0f6d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ros1_1', 'disease_lung_cancer_1', 'ROS1', 
        'c88d44c67e8f4d8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a', datetime('now'), datetime('now'));


-- Disease 6: Inflammatory Conditions
INSERT OR IGNORE INTO diseases (
    id,
    hospital_id,
    disease_name,
    disease_code,
    description,
    constant,
    created_at,
    updated_at
) VALUES (
    'disease_inflammatory_1',
    'hospital_test_1',
    'Chronic Inflammatory Disease',
    'INFLAM-2024',
    'Genetic markers for chronic inflammation and autoimmune conditions',
    55.0,
    datetime('now'),
    datetime('now')
);

-- Disease 6 Genes
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_tnf_1', 'disease_inflammatory_1', 'TNF', 
        'd99e55d78f9a5e9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_il6_1', 'disease_inflammatory_1', 'IL6', 
        'e00f66e89a0b6f0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_il1b_1', 'disease_inflammatory_1', 'IL1B', 
        'f11a77f90b1c7a1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crp_1', 'disease_inflammatory_1', 'CRP', 
        'a22b88a01c2d8b2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', datetime('now'), datetime('now'));


-- Disease 7: Obesity Risk
INSERT OR IGNORE INTO diseases (
    id,
    hospital_id,
    disease_name,
    disease_code,
    description,
    constant,
    created_at,
    updated_at
) VALUES (
    'disease_obesity_1',
    'hospital_test_1',
    'Obesity Susceptibility',
    'OBS-2024',
    'Genetic factors contributing to obesity and metabolic disorders',
    50.0,
    datetime('now'),
    datetime('now')
);

-- Disease 7 Genes
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_fto_2', 'disease_obesity_1', 'FTO', 
        'f33a99f12b3c9a3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_mc4r_1', 'disease_obesity_1', 'MC4R', 
        'b33c99b12d3e9c3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lepr_1', 'disease_obesity_1', 'LEPR', 
        'c44d00c23e4f0d4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pomc_1', 'disease_obesity_1', 'POMC', 
        'd55e11d34f5a1e5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_adrb3_1', 'disease_obesity_1', 'ADRB3', 
        'e66f22e45a6b2f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c', datetime('now'), datetime('now'));


-- Disease 8: Colorectal Cancer
INSERT OR IGNORE INTO diseases (
    id,
    hospital_id,
    disease_name,
    disease_code,
    description,
    constant,
    created_at,
    updated_at
) VALUES (
    'disease_colorectal_1',
    'hospital_test_1',
    'Colorectal Cancer',
    'CRC-2024',
    'Hereditary colorectal cancer syndrome genetic markers',
    72.0,
    datetime('now'),
    datetime('now')
);

-- Disease 8 Genes
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_apc_1', 'disease_colorectal_1', 'APC', 
        'f77a33f56b7c3a7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_mlh1_1', 'disease_colorectal_1', 'MLH1', 
        'a88b44a67c8d4b8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_msh2_1', 'disease_colorectal_1', 'MSH2', 
        'b99c55b78d9e5c9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_tp53_3', 'disease_colorectal_1', 'TP53', 
        'c00d66c89e0f6d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_smad4_1', 'disease_colorectal_1', 'SMAD4', 
        'c99d55c78e9f5d9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a', datetime('now'), datetime('now'));


-- ===================================
-- Audit Logs Table
-- ===================================
-- audit_logs table: stores all system activity for security and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_id TEXT,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success',
  severity TEXT DEFAULT 'info',
  details TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for common audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);


-- ===================================
-- SEED RISK ASSESSMENTS
-- 30 past PSI risk assessments over the past 6 months (July 2025 - December 2025)
-- Distributed across the 4 seeded patients
-- ===================================

-- Patient 1: patient_test_1 (Test Patient) - 8 assessments
-- July 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_001', 'patient_test_1', 50.0, 'disease_breast_cancer_1', 2, '["BRCA1","TP53"]', 50.0, '2025-07-05T10:30:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_002', 'patient_test_1', 45.0, 'disease_diabetes_1', 3, '["TCF7L2","FTO","KCNJ11"]', 45.0, '2025-07-05T10:30:15.000Z');

-- August 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_003', 'patient_test_1', 40.0, 'disease_alzheimers_1', 2, '["APOE","PSEN1"]', 40.0, '2025-08-12T14:20:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_004', 'patient_test_1', 26.0, 'disease_cardiovascular_1', 2, '["MTHFR","LDLR"]', 26.0, '2025-08-12T14:20:30.000Z');

-- October 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_005', 'patient_test_1', 14.0, 'disease_lung_cancer_1', 1, '["TP53"]', 14.0, '2025-10-03T09:15:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_006', 'patient_test_1', 20.0, 'disease_obesity_1', 2, '["FTO","MC4R"]', 20.0, '2025-10-03T09:15:45.000Z');

-- November 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_007', 'patient_test_1', 28.8, 'disease_colorectal_1', 2, '["APC","TP53"]', 28.8, '2025-11-18T16:45:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_008', 'patient_test_1', 27.5, 'disease_inflammatory_1', 2, '["TNF","IL6"]', 27.5, '2025-11-18T16:45:30.000Z');


-- Patient 2: patient_test_2 (John Doe) - 8 assessments
-- July 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_009', 'patient_test_2', 75.0, 'disease_breast_cancer_1', 3, '["BRCA1","BRCA2","TP53"]', 75.0, '2025-07-20T11:00:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_010', 'patient_test_2', 60.0, 'disease_diabetes_1', 4, '["TCF7L2","PPARG","FTO","KCNJ11"]', 60.0, '2025-07-20T11:00:20.000Z');

-- August 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_011', 'patient_test_2', 60.0, 'disease_alzheimers_1', 3, '["APOE","PSEN1","APP"]', 60.0, '2025-08-25T13:30:00.000Z');

-- September 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_012', 'patient_test_2', 39.0, 'disease_cardiovascular_1', 3, '["APOE","ACE","PCSK9"]', 39.0, '2025-09-10T10:45:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_013', 'patient_test_2', 28.0, 'disease_lung_cancer_1', 2, '["EGFR","KRAS"]', 28.0, '2025-09-10T10:45:30.000Z');

-- October 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_014', 'patient_test_2', 30.0, 'disease_obesity_1', 3, '["FTO","MC4R","LEPR"]', 30.0, '2025-10-22T15:20:00.000Z');

-- November 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_015', 'patient_test_2', 43.2, 'disease_colorectal_1', 3, '["APC","MLH1","TP53"]', 43.2, '2025-11-05T08:30:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_016', 'patient_test_2', 41.25, 'disease_inflammatory_1', 3, '["TNF","IL6","CRP"]', 41.25, '2025-11-05T08:30:45.000Z');


-- Patient 3: patient_test_3 (Jane Smith) - 7 assessments
-- July 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_017', 'patient_test_3', 25.0, 'disease_breast_cancer_1', 1, '["BRCA2"]', 25.0, '2025-07-15T09:00:00.000Z');

-- August 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_018', 'patient_test_3', 30.0, 'disease_diabetes_1', 2, '["TCF7L2","PPARG"]', 30.0, '2025-08-08T11:15:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_019', 'patient_test_3', 20.0, 'disease_alzheimers_1', 1, '["APOE"]', 20.0, '2025-08-08T11:15:30.000Z');

-- September 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_020', 'patient_test_3', 52.0, 'disease_cardiovascular_1', 4, '["APOE","MTHFR","ACE","LDLR"]', 52.0, '2025-09-22T14:00:00.000Z');

-- October 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_022', 'patient_test_3', 10.0, 'disease_obesity_1', 1, '["FTO"]', 10.0, '2025-10-15T16:30:30.000Z');

-- December 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_023', 'patient_test_3', 14.4, 'disease_colorectal_1', 1, '["MSH2"]', 14.4, '2025-12-01T10:00:00.000Z');


-- Patient 4: patient_test_4 (Mike Wong) - 7 assessments
-- July 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_024', 'patient_test_4', 50.0, 'disease_breast_cancer_1', 2, '["BRCA1","BRCA2"]', 50.0, '2025-07-28T12:00:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_025', 'patient_test_4', 15.0, 'disease_diabetes_1', 1, '["FTO"]', 15.0, '2025-07-28T12:00:30.000Z');

-- September 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_026', 'patient_test_4', 80.0, 'disease_alzheimers_1', 4, '["APOE","PSEN1","PSEN2","APP"]', 80.0, '2025-09-05T09:30:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_027', 'patient_test_4', 13.0, 'disease_cardiovascular_1', 1, '["APOE"]', 13.0, '2025-09-05T09:30:45.000Z');

-- October 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_028', 'patient_test_4', 42.0, 'disease_lung_cancer_1', 3, '["EGFR","ALK","ROS1"]', 42.0, '2025-10-30T11:45:00.000Z');

-- November 2025
INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_029', 'patient_test_4', 40.0, 'disease_obesity_1', 4, '["FTO","MC4R","LEPR","POMC"]', 40.0, '2025-11-25T14:15:00.000Z');

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('seed_risk_030', 'patient_test_4', 57.6, 'disease_colorectal_1', 4, '["APC","MLH1","MSH2","SMAD4"]', 57.6, '2025-11-25T14:15:30.000Z');

-- ===================================
-- SAMPLE RISK ASSESSMENTS FOR NEW PATIENTS
-- ===================================

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('risk_p5_001', 'patient_005', 75.0, 'disease_diabetes_1', 3, '["TCF7L2","PPARG","FTO"]', 75.0, datetime('now', '-28 days'));

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('risk_p6_001', 'patient_006', 50.0, 'disease_extra_002', 1, '["BRCA1"]', 50.0, datetime('now', '-22 days'));

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('risk_p7_001', 'patient_007', 25.0, 'disease_extra_004', 0, '[]', 25.0, datetime('now', '-18 days'));

INSERT OR IGNORE INTO risk_assessments (id, user_id, overall_risk, disease_id, match_count, matched_genes, risk_percentage, created_at)
VALUES ('risk_p8_001', 'patient_008', 50.0, 'disease_extra_001', 2, '["TP53","EGFR"]', 50.0, datetime('now', '-15 days'));

-- ===================================
-- END OF EXPANDED SEED DATA
-- ===================================

-- ===================================
-- Caregiver Access Table
-- ===================================
-- caregiver_access table: manages patient-caregiver relationships and access permissions
CREATE TABLE IF NOT EXISTS caregiver_access (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  caregiver_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  can_run_assessments INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(patient_id, caregiver_id)
);

-- Indexes for caregiver access queries
CREATE INDEX IF NOT EXISTS idx_caregiver_access_patient ON caregiver_access(patient_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_access_caregiver ON caregiver_access(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_access_status ON caregiver_access(status);
CREATE INDEX IF NOT EXISTS idx_caregiver_access_can_run_assessments ON caregiver_access(can_run_assessments); -- For permission checks


-- ===================================
-- SEED CAREGIVER AND CAREGIVER ACCESS DATA
-- ===================================

-- Insert test caregiver user
INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    phone,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'caregiver_test_1',
    'caregiver@test.com',
    '$2b$10$HAcdXOtRSARIPl4RH8Ed1.GpN93fuqkIoe00O6oduIMAOT.QogV5u',
    'caregiver',
    'Mary',
    'Caregiver',
    '+1234567890',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

-- Insert a second test caregiver
INSERT OR IGNORE INTO users (
    id, 
    email, 
    password_hash, 
    role, 
    first_name, 
    last_name,
    phone,
    status,
    research_consent,
    created_at,
    updated_at
) VALUES (
    'caregiver_test_2',
    'sarah.caregiver@email.com',
    '$2b$10$ehqNtZfvaJwaLxBmFGs26uhYqDhOQhii2sYaATeha3xUZsK9C/DIS',
    'caregiver',
    'Sarah',
    'Johnson',
    '+0987654321',
    'active',
    0,
    datetime('now'),
    datetime('now')
);

-- Seed caregiver access relationships
-- Caregiver 1 has active access to Patient 1 (spouse relationship)
INSERT OR IGNORE INTO caregiver_access (
    id,
    patient_id,
    caregiver_id,
    relationship,
    status,
    created_at,
    updated_at,
    accepted_at
) VALUES (
    'access_001',
    'patient_test_1',
    'caregiver_test_1',
    'spouse',
    'active',
    datetime('now', '-30 days'),
    datetime('now', '-29 days'),
    datetime('now', '-29 days')
);

-- Caregiver 1 has pending invitation from Patient 2 (parent relationship)
INSERT OR IGNORE INTO caregiver_access (
    id,
    patient_id,
    caregiver_id,
    relationship,
    status,
    created_at,
    updated_at
) VALUES (
    'access_002',
    'patient_test_2',
    'caregiver_test_1',
    'parent',
    'pending',
    datetime('now', '-2 days'),
    datetime('now', '-2 days')
);

-- Caregiver 2 has active access to Patient 3 (professional caregiver)
INSERT OR IGNORE INTO caregiver_access (
    id,
    patient_id,
    caregiver_id,
    relationship,
    status,
    created_at,
    updated_at,
    accepted_at
) VALUES (
    'access_003',
    'patient_test_3',
    'caregiver_test_2',
    'caregiver',
    'active',
    datetime('now', '-15 days'),
    datetime('now', '-14 days'),
    datetime('now', '-14 days')
);

-- Add can_run_assessments column to caregiver_access table
-- This allows patients to control whether caregivers can initiate PSI risk assessments
-- ALTER TABLE caregiver_access ADD COLUMN can_run_assessments INTEGER DEFAULT 0;

-- Create index for faster permission checks

-- ===================================
-- EXPANDED SEED DATA (CORRECTED)
-- ===================================

-- ===================================
-- HOSPITAL ADMINS (admin role)
-- ===================================

-- Singapore General Hospital Admin
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, status, research_consent, created_at, updated_at
) VALUES (
    'admin_sgh_001',
    'admin@sgh.com.sg',
    '$2b$10$nfdXaqhn3Ecuh0GR9Z3dsuCPN88AGhDvHhFmODmJhHYI4.97XnjqO',
    'admin',
    'Sarah',
    'Tan',
    'Singapore General Hospital',
    'active',
    0,
    datetime('now', '-180 days'),
    datetime('now', '-5 days')
);

-- National University Hospital Admin
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, status, research_consent, created_at, updated_at
) VALUES (
    'admin_nuh_001',
    'admin@nuh.edu.sg',
    '$2b$10$nfdXaqhn3Ecuh0GR9Z3dsuCPN88AGhDvHhFmODmJhHYI4.97XnjqO',
    'admin',
    'David',
    'Lim',
    'National University Hospital',
    'active',
    0,
    datetime('now', '-200 days'),
    datetime('now', '-10 days')
);

-- Tan Tock Seng Hospital Admin  
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, status, research_consent, created_at, updated_at
) VALUES (
    'admin_ttsh_001',
    'admin@ttsh.com.sg',
    '$2b$10$nfdXaqhn3Ecuh0GR9Z3dsuCPN88AGhDvHhFmODmJhHYI4.97XnjqO',
    'admin',
    'Michelle',
    'Wong',
    'Tan Tock Seng Hospital',
    'active',
    0,
    datetime('now', '-150 days'),
    datetime('now', '-3 days')
);

-- Mount Elizabeth Hospital Admin
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, status, research_consent, created_at, updated_at
) VALUES (
    'admin_meh_001',
    'admin@mountelizabeth.com.sg',
    '$2b$10$nfdXaqhn3Ecuh0GR9Z3dsuCPN88AGhDvHhFmODmJhHYI4.97XnjqO',
    'admin',
    'Jennifer',
    'Chen',
    'Mount Elizabeth Hospital',
    'active',
    0,
    datetime('now', '-120 days'),
    datetime('now', '-7 days')
);

-- Raffles Hospital Admin
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, status, research_consent, created_at, updated_at
) VALUES (
    'admin_raffles_001',
    'admin@rafflesmedical.com',
    '$2b$10$nfdXaqhn3Ecuh0GR9Z3dsuCPN88AGhDvHhFmODmJhHYI4.97XnjqO',
    'admin',
    'Robert',
    'Koh',
    'Raffles Hospital',
    'active',
    0,
    datetime('now', '-90 days'),
    datetime('now', '-2 days')
);

-- ===================================
-- HOSPITAL SPECIALISTS (hospital role)
-- ===================================

-- SGH Specialists
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_sgh_001',
    'dr.tan@sgh.com.sg',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Kevin',
    'Tan',
    'Singapore General Hospital',
    'Cardiology',
    'MD-SGH-2015-001',
    'active',
    0,
    datetime('now', '-150 days'),
    datetime('now', '-1 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_sgh_002',
    'dr.lim@sgh.com.sg',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Rachel',
    'Lim',
    'Singapore General Hospital',
    'Oncology',
    'MD-SGH-2017-045',
    'active',
    0,
    datetime('now', '-140 days'),
    datetime('now', '-2 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_sgh_003',
    'dr.ng@sgh.com.sg',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Benjamin',
    'Ng',
    'Singapore General Hospital',
    'Neurology',
    'MD-SGH-2018-092',
    'active',
    0,
    datetime('now', '-130 days'),
    datetime('now')
);

-- NUH Specialists
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_nuh_001',
    'dr.chan@nuh.edu.sg',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Emily',
    'Chan',
    'National University Hospital',
    'Genetics',
    'MD-NUH-2016-023',
    'active',
    0,
    datetime('now', '-160 days'),
    datetime('now', '-3 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_nuh_002',
    'dr.wong@nuh.edu.sg',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Marcus',
    'Wong',
    'National University Hospital',
    'Endocrinology',
    'MD-NUH-2019-067',
    'active',
    0,
    datetime('now', '-145 days'),
    datetime('now', '-1 days')
);

-- TTSH Specialists
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_ttsh_001',
    'dr.lee@ttsh.com.sg',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Stephanie',
    'Lee',
    'Tan Tock Seng Hospital',
    'Cardiology',
    'MD-TTSH-2020-011',
    'active',
    0,
    datetime('now', '-100 days'),
    datetime('now', '-4 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_ttsh_002',
    'dr.kumar@ttsh.com.sg',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Rajesh',
    'Kumar',
    'Tan Tock Seng Hospital',
    'Infectious Disease',
    'MD-TTSH-2018-034',
    'active',
    0,
    datetime('now', '-110 days'),
    datetime('now', '-2 days')
);

-- Mount Elizabeth Specialists
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_meh_001',
    'dr.zhao@mountelizabeth.com.sg',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Lisa',
    'Zhao',
    'Mount Elizabeth Hospital',
    'Oncology',
    'MD-MEH-2019-078',
    'active',
    0,
    datetime('now', '-95 days'),
    datetime('now', '-5 days')
);

-- Raffles Hospital Specialists
INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    organization_name, specialty, license_number, status, research_consent, created_at, updated_at
) VALUES (
    'hospital_raffles_001',
    'dr.tan@rafflesmedical.com',
    '$2b$10$KmxdbP9Z8MckQBsUnxIU/O36fcErCYUTv5GKYxpCLBrxdqZZz2ycC',
    'hospital',
    'Jonathan',
    'Tan',
    'Raffles Hospital',
    'Genetics',
    'MD-RAF-2021-003',
    'active',
    0,
    datetime('now', '-80 days'),
    datetime('now', '-1 days')
);

-- ===================================
-- RESEARCHERS (researcher role)
-- ===================================

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    institution, research_area, status, research_consent, created_at, updated_at
) VALUES (
    'researcher_002',
    'j.smith@ntu.edu.sg',
    '$2b$10$2Umo8xEv0piFhn8P9lQoIOlVm9KT3ElA4ZwnnRvz4T.Z70B14BTxa',
    'researcher',
    'Dr. James',
    'Smith',
    'Nanyang Technological University',
    'Cardiovascular Genetics',
    'active',
    0,
    datetime('now', '-180 days'),
    datetime('now', '-5 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    institution, research_area, status, research_consent, created_at, updated_at
) VALUES (
    'researcher_003',
    'maria.garcia@astar.edu.sg',
    '$2b$10$2Umo8xEv0piFhn8P9lQoIOlVm9KT3ElA4ZwnnRvz4T.Z70B14BTxa',
    'researcher',
    'Dr. Maria',
    'Garcia',
    'A*STAR Genome Institute',
    'Cancer Genomics',
    'active',
    0,
    datetime('now', '-150 days'),
    datetime('now', '-1 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    institution, research_area, status, research_consent, created_at, updated_at
) VALUES (
    'researcher_004',
    'y.tanaka@duke-nus.edu.sg',
    '$2b$10$2Umo8xEv0piFhn8P9lQoIOlVm9KT3ElA4ZwnnRvz4T.Z70B14BTxa',
    'researcher',
    'Dr. Yuki',
    'Tanaka',
    'Duke-NUS Medical School',
    'Diabetes and Metabolic Disorders',
    'active',
    0,
    datetime('now', '-120 days'),
    datetime('now', '-2 days')
);

-- ===================================
-- ADDITIONAL PATIENTS (patient role)
-- ===================================

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    date_of_birth, phone, address, status, research_consent, created_at, updated_at
) VALUES (
    'patient_005',
    'sarah.johnson@email.com',
    '$2b$10$fKsGO9lFa4l70xK0/6R5ru6wD5Xl3AZIZPLGS2FpbKRz.KW5L2JG2',
    'patient',
    'Sarah',
    'Johnson',
    '1985-03-15',
    '+65 8765 4321',
    '123 Orchard Road, Singapore 238858',
    'active',
    1,
    datetime('now', '-120 days'),
    datetime('now', '-2 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    date_of_birth, phone, status, research_consent, created_at, updated_at
) VALUES (
    'patient_006',
    'michael.tan@email.com',
    '$2b$10$fKsGO9lFa4l70xK0/6R5ru6wD5Xl3AZIZPLGS2FpbKRz.KW5L2JG2',
    'patient',
    'Michael',
    'Tan',
    '1992-07-22',
    '+65 9123 4567',
    'active',
    1,
    datetime('now', '-90 days'),
    datetime('now', '-5 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    date_of_birth, status, research_consent, created_at, updated_at
) VALUES (
    'patient_007',
    'linda.ng@email.com',
    '$2b$10$fKsGO9lFa4l70xK0/6R5ru6wD5Xl3AZIZPLGS2FpbKRz.KW5L2JG2',
    'patient',
    'Linda',
    'Ng',
    '1978-11-08',
    'active',
    0,
    datetime('now', '-75 days'),
    datetime('now', '-1 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    date_of_birth, phone, status, research_consent, created_at, updated_at
) VALUES (
    'patient_008',
    'david.lim@email.com',
    '$2b$10$fKsGO9lFa4l70xK0/6R5ru6wD5Xl3AZIZPLGS2FpbKRz.KW5L2JG2',
    'patient',
    'David',
    'Lim',
    '1995-05-30',
    '+65 8234 5678',
    'active',
    1,
    datetime('now', '-60 days'),
    datetime('now', '-3 days')
);

-- ===================================
-- ADDITIONAL CAREGIVERS (caregiver role)
-- ===================================

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    phone, status, research_consent, created_at, updated_at
) VALUES (
    'caregiver_003',
    'nurse.mary@email.com',
    '$2b$10$ehqNtZfvaJwaLxBmFGs26uhYqDhOQhii2sYaATeha3xUZsK9C/DIS',
    'caregiver',
    'Mary',
    'Fernandez',
    '+65 8111 2222',
    'active',
    0,
    datetime('now', '-85 days'),
    datetime('now', '-2 days')
);

INSERT OR IGNORE INTO users (
    id, email, password_hash, role, first_name, last_name,
    phone, status, research_consent, created_at, updated_at
) VALUES (
    'caregiver_004',
    'james.parent@email.com',
    '$2b$10$ehqNtZfvaJwaLxBmFGs26uhYqDhOQhii2sYaATeha3xUZsK9C/DIS',
    'caregiver',
    'James',
    'Anderson',
    '+65 9222 3333',
    'active',
    0,
    datetime('now', '-70 days'),
    datetime('now', '-5 days')
);

-- ===================================
-- ADDITIONAL CAREGIVER ACCESS
-- ===================================

INSERT OR IGNORE INTO caregiver_access (
    id, patient_id, caregiver_id, relationship, status,
    created_at, updated_at, accepted_at
) VALUES (
    'access_004',
    'patient_005',
    'caregiver_003',
    'spouse',
    'active',
    datetime('now', '-30 days'),
    datetime('now', '-29 days'),
    datetime('now', '-29 days')
);

INSERT OR IGNORE INTO caregiver_access (
    id, patient_id, caregiver_id, relationship, status,
    created_at, updated_at
) VALUES (
    'access_005',
    'patient_006',
    'caregiver_004',
    'parent',
    'pending',
    datetime('now', '-5 days'),
    datetime('now', '-5 days')
);


-- ===================================
-- CLINVAR-SOURCED DISEASE-GENE SEED DATA
-- ===================================
-- Source: ClinVar (NCBI) gene-condition associations
-- Reference: https://www.ncbi.nlm.nih.gov/clinvar/
-- Additional validation: gnomAD, GWAS Catalog, PubMed literature
-- Last updated: February 2026
--
-- This replaces the original manually curated seed data
-- with clinically validated gene-disease associations from
-- ClinVar's public gene_condition_source_id database.
--
-- IMPORTANT: The hash_value fields are placeholder hex strings.
-- The actual SHA-256 hashes are computed at runtime by the PSI
-- protocol (Web Crypto API), so these placeholder values do not
-- affect PSI computation. They exist only to satisfy the NOT NULL
-- constraint in the database schema.
-- ===================================


-- ===================================
-- Disease 1: Breast Cancer (hospital_test_1)
-- ClinVar: Hereditary breast cancer susceptibility genes
-- Sources: BRCA1/2 (high penetrance), PALB2/ATM/CHEK2 (moderate),
--          CDH1/PTEN/TP53/RAD51C/RAD51D/BARD1 (established panel genes)
-- ===================================

DELETE FROM disease_genes WHERE disease_id = 'disease_breast_cancer_1';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_brca1', 'disease_breast_cancer_1', 'BRCA1', 
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_brca2', 'disease_breast_cancer_1', 'BRCA2', 
        'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_tp53', 'disease_breast_cancer_1', 'TP53', 
        'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_palb2', 'disease_breast_cancer_1', 'PALB2', 
        'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_atm', 'disease_breast_cancer_1', 'ATM', 
        'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_chek2', 'disease_breast_cancer_1', 'CHEK2', 
        'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_cdh1', 'disease_breast_cancer_1', 'CDH1', 
        'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_pten', 'disease_breast_cancer_1', 'PTEN', 
        'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_rad51c', 'disease_breast_cancer_1', 'RAD51C', 
        'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_bc_bard1', 'disease_breast_cancer_1', 'BARD1', 
        'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1', datetime('now'), datetime('now'));
-- Breast Cancer: 3 genes → 10 genes


-- ===================================
-- Disease 2: Type 2 Diabetes (hospital_test_1)
-- ClinVar + GWAS Catalog: Confirmed T2D susceptibility genes
-- Sources: TCF7L2 (strongest), PPARG/KCNJ11 (established),
--          SLC30A8/CDKAL1/CDKN2A/IGF2BP2/HHEX/FTO/ABCC8/HNF4A
-- ===================================

DELETE FROM disease_genes WHERE disease_id = 'disease_diabetes_1';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_tcf7l2', 'disease_diabetes_1', 'TCF7L2', 
        'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_pparg', 'disease_diabetes_1', 'PPARG', 
        'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_fto', 'disease_diabetes_1', 'FTO', 
        'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_kcnj11', 'disease_diabetes_1', 'KCNJ11', 
        'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_slc30a8', 'disease_diabetes_1', 'SLC30A8', 
        'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_cdkal1', 'disease_diabetes_1', 'CDKAL1', 
        'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_cdkn2a', 'disease_diabetes_1', 'CDKN2A', 
        'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_hhex', 'disease_diabetes_1', 'HHEX', 
        'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_abcc8', 'disease_diabetes_1', 'ABCC8', 
        'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_t2d_hnf4a', 'disease_diabetes_1', 'HNF4A', 
        'a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4', datetime('now'), datetime('now'));
-- Type 2 Diabetes: 4 genes → 10 genes



-- ===================================
-- Disease 3: Alzheimer's Disease (hospital_test_1)
-- ClinVar: Alzheimer disease susceptibility and causative genes
-- Sources: APOE (strongest risk), APP/PSEN1/PSEN2 (early-onset),
--          TREM2/SORL1/ABCA7/CLU/BIN1/CR1 (late-onset risk)
-- ===================================

DELETE FROM disease_genes WHERE disease_id = 'disease_alzheimers_1';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_apoe', 'disease_alzheimers_1', 'APOE', 
        'd77e33d56f7a3e7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_psen1', 'disease_alzheimers_1', 'PSEN1', 
        'e88f44e67a8b4f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_psen2', 'disease_alzheimers_1', 'PSEN2', 
        'f99a55f78b9c5a9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_app', 'disease_alzheimers_1', 'APP', 
        'a00b66a89c0d6b0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_trem2', 'disease_alzheimers_1', 'TREM2', 
        'b11c77b90d1e7c1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_sorl1', 'disease_alzheimers_1', 'SORL1', 
        'c22d88c01e2f8d2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_abca7', 'disease_alzheimers_1', 'ABCA7', 
        'd33e99d12f3a9e3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_clu', 'disease_alzheimers_1', 'CLU', 
        'e44f00e23a4b0f4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz_bin1', 'disease_alzheimers_1', 'BIN1', 
        'f55a11f34b5c1a5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d', datetime('now'), datetime('now'));
-- Alzheimer's: 4 genes → 9 genes


-- ===================================
-- Disease 4: Cardiovascular Disease (hospital_test_1)
-- ClinVar: Familial hypercholesterolemia and cardiovascular risk genes
-- Sources: LDLR/APOB/PCSK9 (FH causative), APOE/MTHFR/ACE (risk),
--          LPA/NPC1L1/ABCG5/MYBPC3 (additional cardiovascular)
-- ===================================

DELETE FROM disease_genes WHERE disease_id = 'disease_cardiovascular_1';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_apoe', 'disease_cardiovascular_1', 'APOE', 
        'd77e33d56f7a3e7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_mthfr', 'disease_cardiovascular_1', 'MTHFR', 
        'b11c77b90d1e7c1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_ace', 'disease_cardiovascular_1', 'ACE', 
        'c22d88c01e2f8d2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_ldlr', 'disease_cardiovascular_1', 'LDLR', 
        'd33e99d12f3a9e3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_pcsk9', 'disease_cardiovascular_1', 'PCSK9', 
        'e44f00e23a4b0f4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_apob', 'disease_cardiovascular_1', 'APOB', 
        'f55a11f34b5c1a5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_lpa', 'disease_cardiovascular_1', 'LPA', 
        'a66b22a45c6d2b6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_npc1l1', 'disease_cardiovascular_1', 'NPC1L1', 
        'b77c33b56d7e3c7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_abcg5', 'disease_cardiovascular_1', 'ABCG5', 
        'c88d44c67e8f4d8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cvd_mybpc3', 'disease_cardiovascular_1', 'MYBPC3', 
        'd99e55d78f9a5e9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b', datetime('now'), datetime('now'));
-- Cardiovascular Disease: 5 genes → 10 genes


-- ===================================
-- Disease 5: Lung Cancer (hospital_test_1)
-- ClinVar: Lung cancer susceptibility and driver genes
-- Sources: EGFR/KRAS/ALK/ROS1 (driver mutations/targeted therapy),
--          TP53/STK11/BRAF/MET/RET/ERBB2 (additional ClinVar-listed)
-- ===================================

DELETE FROM disease_genes WHERE disease_id = 'disease_lung_cancer_1';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_egfr', 'disease_lung_cancer_1', 'EGFR', 
        'f55a11f34b5c1a5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_kras', 'disease_lung_cancer_1', 'KRAS', 
        'a66b22a45c6d2b6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_alk', 'disease_lung_cancer_1', 'ALK', 
        'b77c33b56d7e3c7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_tp53', 'disease_lung_cancer_1', 'TP53', 
        'c00d66c89e0f6d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_ros1', 'disease_lung_cancer_1', 'ROS1', 
        'c88d44c67e8f4d8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_stk11', 'disease_lung_cancer_1', 'STK11', 
        'd99e55d78f9a5e9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_braf', 'disease_lung_cancer_1', 'BRAF', 
        'e00f66e89a0b6f0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_met', 'disease_lung_cancer_1', 'MET', 
        'f11a77f90b1c7a1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_ret', 'disease_lung_cancer_1', 'RET', 
        'a22b88a01c2d8b2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lc_erbb2', 'disease_lung_cancer_1', 'ERBB2', 
        'b33c99b12d3e9c3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f', datetime('now'), datetime('now'));
-- Lung Cancer: 5 genes → 10 genes


-- ===================================
-- Disease 6: Chronic Inflammatory Disease (hospital_test_1)
-- ClinVar: Chronic inflammation and autoimmune condition genes
-- Sources: TNF/IL6/IL1B/CRP (original), plus NOD2/IL23R/CARD9/
--          HLA-DRB1/PTPN22/STAT3 (ClinVar autoimmune/inflammatory)
-- ===================================

DELETE FROM disease_genes WHERE disease_id = 'disease_inflammatory_1';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_inf_tnf', 'disease_inflammatory_1', 'TNF', 
        'd99e55d78f9a5e9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_inf_il6', 'disease_inflammatory_1', 'IL6', 
        'e00f66e89a0b6f0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_inf_il1b', 'disease_inflammatory_1', 'IL1B', 
        'f11a77f90b1c7a1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_inf_crp', 'disease_inflammatory_1', 'CRP', 
        'a22b88a01c2d8b2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_inf_nod2', 'disease_inflammatory_1', 'NOD2', 
        'b33c99b12d3e9c3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_inf_il23r', 'disease_inflammatory_1', 'IL23R', 
        'c44d00c23e4f0d4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_inf_card9', 'disease_inflammatory_1', 'CARD9', 
        'd55e11d34f5a1e5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_inf_ptpn22', 'disease_inflammatory_1', 'PTPN22', 
        'e66f22e45a6b2f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c', datetime('now'), datetime('now'));
-- Chronic Inflammatory: 4 genes → 8 genes


-- ===================================
-- Disease 7: Obesity Susceptibility (hospital_test_1)
-- ClinVar + GWAS: Obesity and metabolic disorder genes
-- Sources: FTO (strongest GWAS), MC4R/LEPR/POMC/ADRB3 (original),
--          LEP/PCSK1/SIM1/BDNF (ClinVar monogenic/polygenic obesity)
-- ===================================

DELETE FROM disease_genes WHERE disease_id = 'disease_obesity_1';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_fto', 'disease_obesity_1', 'FTO', 
        'f33a99f12b3c9a3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_mc4r', 'disease_obesity_1', 'MC4R', 
        'b33c99b12d3e9c3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_lepr', 'disease_obesity_1', 'LEPR', 
        'c44d00c23e4f0d4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_pomc', 'disease_obesity_1', 'POMC', 
        'd55e11d34f5a1e5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_adrb3', 'disease_obesity_1', 'ADRB3', 
        'e66f22e45a6b2f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_lep', 'disease_obesity_1', 'LEP', 
        'f77a33f56b7c3a7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_pcsk1', 'disease_obesity_1', 'PCSK1', 
        'a88b44a67c8d4b8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_sim1', 'disease_obesity_1', 'SIM1', 
        'b99c55b78d9e5c9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_ob_bdnf', 'disease_obesity_1', 'BDNF', 
        'c00d66c89e0f6d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a', datetime('now'), datetime('now'));
-- Obesity: 5 genes → 9 genes


-- ===================================
-- Disease 8: Colorectal Cancer (hospital_test_1)
-- ClinVar: Lynch syndrome and hereditary colorectal cancer genes
-- Sources: APC (FAP), MLH1/MSH2/MSH6/PMS2 (Lynch syndrome),
--          TP53/SMAD4/BMPR1A/STK11/MUTYH (additional CRC panel genes)
-- ===================================

DELETE FROM disease_genes WHERE disease_id = 'disease_colorectal_1';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_apc', 'disease_colorectal_1', 'APC', 
        'f77a33f56b7c3a7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_mlh1', 'disease_colorectal_1', 'MLH1', 
        'a88b44a67c8d4b8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_msh2', 'disease_colorectal_1', 'MSH2', 
        'b99c55b78d9e5c9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_tp53', 'disease_colorectal_1', 'TP53', 
        'c00d66c89e0f6d0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_smad4', 'disease_colorectal_1', 'SMAD4', 
        'c99d55c78e9f5d9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_msh6', 'disease_colorectal_1', 'MSH6', 
        'd11e66d89f0a6e0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_pms2', 'disease_colorectal_1', 'PMS2', 
        'e22f77e90a1b7f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_bmpr1a', 'disease_colorectal_1', 'BMPR1A', 
        'f33a88f01b2c8a2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_stk11', 'disease_colorectal_1', 'STK11', 
        'a44b99a12c3d9b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e', datetime('now'), datetime('now'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_crc_mutyh', 'disease_colorectal_1', 'MUTYH', 
        'b55c00b23d4e0c4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f', datetime('now'), datetime('now'));
-- Colorectal Cancer: 5 genes → 10 genes


-- ===================================
-- EXTRA DISEASES (hospital_test_2 and hospital_test_3)
-- These also get expanded with ClinVar-sourced genes
-- ===================================

-- Disease 9: Hypertrophic Cardiomyopathy (hospital_test_2)
-- ClinVar: HCM causative genes
DELETE FROM disease_genes WHERE disease_id = 'disease_extra_001';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hcm_myh7', 'disease_extra_001', 'MYH7', 
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', datetime('now', '-150 days'), datetime('now', '-10 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hcm_mybpc3', 'disease_extra_001', 'MYBPC3', 
        'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', datetime('now', '-150 days'), datetime('now', '-10 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hcm_tnnt2', 'disease_extra_001', 'TNNT2', 
        'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', datetime('now', '-150 days'), datetime('now', '-10 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hcm_tpm1', 'disease_extra_001', 'TPM1', 
        'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', datetime('now', '-150 days'), datetime('now', '-10 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hcm_actc1', 'disease_extra_001', 'ACTC1', 
        'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', datetime('now', '-150 days'), datetime('now', '-10 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hcm_myl2', 'disease_extra_001', 'MYL2', 
        'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', datetime('now', '-150 days'), datetime('now', '-10 days'));
-- HCM: 2 genes → 6 genes


-- Disease 10: Hereditary Breast Cancer (hospital_test_2)
DELETE FROM disease_genes WHERE disease_id = 'disease_extra_002';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hbc_brca1', 'disease_extra_002', 'BRCA1', 
        'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', datetime('now', '-145 days'), datetime('now', '-8 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hbc_brca2', 'disease_extra_002', 'BRCA2', 
        'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', datetime('now', '-145 days'), datetime('now', '-8 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hbc_palb2', 'disease_extra_002', 'PALB2', 
        'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', datetime('now', '-145 days'), datetime('now', '-8 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hbc_tp53', 'disease_extra_002', 'TP53', 
        'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', datetime('now', '-145 days'), datetime('now', '-8 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_hbc_rad51d', 'disease_extra_002', 'RAD51D', 
        'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', datetime('now', '-145 days'), datetime('now', '-8 days'));
-- Hereditary Breast Cancer: 2 genes → 5 genes


-- Disease 11: Cystic Fibrosis (hospital_test_2)
DELETE FROM disease_genes WHERE disease_id = 'disease_extra_003';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cf_cftr', 'disease_extra_003', 'CFTR', 
        'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', datetime('now', '-140 days'), datetime('now', '-6 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cf_scnn1b', 'disease_extra_003', 'SCNN1B', 
        'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', datetime('now', '-140 days'), datetime('now', '-6 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cf_scnn1a', 'disease_extra_003', 'SCNN1A', 
        'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', datetime('now', '-140 days'), datetime('now', '-6 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cf_tgfb1', 'disease_extra_003', 'TGFB1', 
        'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', datetime('now', '-140 days'), datetime('now', '-6 days'));
-- Cystic Fibrosis: 1 gene → 4 genes


-- Disease 12: Parkinsons Disease (hospital_test_3)
DELETE FROM disease_genes WHERE disease_id = 'disease_extra_004';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pd_snca', 'disease_extra_004', 'SNCA', 
        'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', datetime('now', '-135 days'), datetime('now', '-5 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pd_lrrk2', 'disease_extra_004', 'LRRK2', 
        'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', datetime('now', '-135 days'), datetime('now', '-5 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pd_park7', 'disease_extra_004', 'PARK7', 
        'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', datetime('now', '-135 days'), datetime('now', '-5 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pd_pink1', 'disease_extra_004', 'PINK1', 
        'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0', datetime('now', '-135 days'), datetime('now', '-5 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pd_prkn', 'disease_extra_004', 'PRKN', 
        'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1', datetime('now', '-135 days'), datetime('now', '-5 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pd_gba1', 'disease_extra_004', 'GBA1', 
        'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', datetime('now', '-135 days'), datetime('now', '-5 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_pd_vps35', 'disease_extra_004', 'VPS35', 
        'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3', datetime('now', '-135 days'), datetime('now', '-5 days'));
-- Parkinsons: 2 genes → 7 genes


-- Disease 13: Alzheimers Disease (hospital_test_3)
DELETE FROM disease_genes WHERE disease_id = 'disease_extra_005';

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz2_apoe', 'disease_extra_005', 'APOE', 
        'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', datetime('now', '-130 days'), datetime('now', '-4 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz2_psen1', 'disease_extra_005', 'PSEN1', 
        'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0', datetime('now', '-130 days'), datetime('now', '-4 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz2_app', 'disease_extra_005', 'APP', 
        'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1', datetime('now', '-130 days'), datetime('now', '-4 days'));
INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_alz2_trem2', 'disease_extra_005', 'TREM2', 
        'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', datetime('now', '-130 days'), datetime('now', '-4 days'));
-- Alzheimers (hospital_test_3): 1 gene → 4 genes


-- ===================================
-- ADDITIONAL DISEASES (CORRECTED SCHEMA)
-- Note: Using hospital_test_1 ID since we need actual hospital user IDs
-- ===================================

-- Disease 8: Hypertrophic Cardiomyopathy
INSERT OR IGNORE INTO diseases (
    id, hospital_id, disease_name, disease_code, description, constant,
    created_at, updated_at
) VALUES (
    'disease_extra_001',
    'hospital_test_2',
    'Hypertrophic Cardiomyopathy',
    'HCM-2024',
    'Cardiovascular - Genetic heart muscle disorder',
    50.0,
    datetime('now', '-150 days'),
    datetime('now', '-10 days')
);

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_myh7_extra', 'disease_extra_001', 'MYH7', 
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', datetime('now', '-150 days'), datetime('now', '-10 days'));

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_mybpc3_extra', 'disease_extra_001', 'MYBPC3', 
        'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', datetime('now', '-150 days'), datetime('now', '-10 days'));

-- Disease 9: Hereditary Breast Cancer
INSERT OR IGNORE INTO diseases (
    id, hospital_id, disease_name, disease_code, description, constant,
    created_at, updated_at
) VALUES (
    'disease_extra_002',
    'hospital_test_2',
    'Hereditary Breast Cancer',
    'BRCA-2024',
    'Cancer - Breast cancer with genetic predisposition',
    50.0,
    datetime('now', '-145 days'),
    datetime('now', '-8 days')
);

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_brca1_extra', 'disease_extra_002', 'BRCA1', 
        'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', datetime('now', '-145 days'), datetime('now', '-8 days'));

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_brca2_extra', 'disease_extra_002', 'BRCA2', 
        'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5', datetime('now', '-145 days'), datetime('now', '-8 days'));

-- Disease 10: Cystic Fibrosis
INSERT OR IGNORE INTO diseases (
    id, hospital_id, disease_name, disease_code, description, constant,
    created_at, updated_at
) VALUES (
    'disease_extra_003',
    'hospital_test_2',
    'Cystic Fibrosis',
    'CF-2024',
    'Respiratory - Genetic disorder affecting lungs and digestive system',
    50.0,
    datetime('now', '-140 days'),
    datetime('now', '-6 days')
);

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_cftr_extra', 'disease_extra_003', 'CFTR', 
        'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', datetime('now', '-140 days'), datetime('now', '-6 days'));

-- Disease 11: Parkinsons Disease
INSERT OR IGNORE INTO diseases (
    id, hospital_id, disease_name, disease_code, description, constant,
    created_at, updated_at
) VALUES (
    'disease_extra_004',
    'hospital_test_3',
    'Parkinsons Disease',
    'PD-2024',
    'Neurological - Progressive nervous system disorder',
    50.0,
    datetime('now', '-135 days'),
    datetime('now', '-5 days')
);

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_snca_extra', 'disease_extra_004', 'SNCA', 
        'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', datetime('now', '-135 days'), datetime('now', '-5 days'));

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_lrrk2_extra', 'disease_extra_004', 'LRRK2', 
        'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', datetime('now', '-135 days'), datetime('now', '-5 days'));

-- Disease 12: Alzheimers Disease
INSERT OR IGNORE INTO diseases (
    id, hospital_id, disease_name, disease_code, description, constant,
    created_at, updated_at
) VALUES (
    'disease_extra_005',
    'hospital_test_3',
    'Alzheimers Disease',
    'AD-2024',
    'Neurological - Progressive brain disorder affecting memory',
    50.0,
    datetime('now', '-130 days'),
    datetime('now', '-4 days')
);

INSERT OR IGNORE INTO disease_genes (id, disease_id, gene_symbol, hash_value, created_at, updated_at)
VALUES ('gene_apoe_extra', 'disease_extra_005', 'APOE', 
        'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', datetime('now', '-130 days'), datetime('now', '-4 days'));
