const bcrypt = require('bcrypt');
const userService = require('../services/userService');
const db = require('../../DBMS/db/db');

jest.mock('../../DBMS/db/db', () => {
  const run = jest.fn();
  const get = jest.fn();
  const all = jest.fn();
  return { run, get, all };
});

jest.mock('bcrypt', () => ({
  hash: jest.fn(async () => 'hashed-password'),
  compare: jest.fn(async () => true),
}));

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createUser hashes password and inserts user', async () => {
    db.run.mockResolvedValue({});

    const result = await userService.createUser({
      email: 'test@example.com',
      password: 'password123',
      role: 'patient',
      firstName: 'John',
      lastName: 'Doe',
      phone: '123',
    });

    expect(bcrypt.hash).toHaveBeenCalled();
    expect(db.run).toHaveBeenCalled();
    expect(result).toHaveProperty('id');
    expect(result).toMatchObject({
      email: 'test@example.com',
      role: 'patient',
      status: 'active',
    });
  });

  test('authenticateUser returns null when user not found', async () => {
    db.get.mockResolvedValue(null);

    const user = await userService.authenticateUser('missing@example.com', 'password');
    expect(user).toBeNull();
  });

  test('authenticateUser throws for deleted user', async () => {
    db.get.mockResolvedValue({
      id: '1',
      email: 'deleted@example.com',
      status: 'deleted',
      password_hash: 'hash',
      research_consent: 0,
    });

    await expect(
      userService.authenticateUser('deleted@example.com', 'password'),
    ).rejects.toThrow('This account has been deleted');
  });

  test('emailExists returns boolean', async () => {
    db.get.mockResolvedValue({ id: '1' });
    const exists = await userService.emailExists('exists@example.com');
    expect(exists).toBe(true);

    db.get.mockResolvedValue(null);
    const notExists = await userService.emailExists('no@example.com');
    expect(notExists).toBe(false);
  });

  test('updateUserStatus updates status via run()', async () => {
    db.run.mockResolvedValue({});
    db.get.mockResolvedValue({ id: '1', email: 'a@b.com', research_consent: 0 });

    const user = await userService.updateUserStatus('1', 'active');

    expect(db.run).toHaveBeenCalled();
    expect(user).toMatchObject({ id: '1', email: 'a@b.com' });
  });

  test('getUserById retrieves user by ID', async () => {
    const mockUser = { id: '1', email: 'test@example.com', research_consent: 0 };
    db.get.mockResolvedValue(mockUser);

    const user = await userService.getUserById('1');

    expect(db.get).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['1']);
    expect(user).toMatchObject({ id: '1', email: 'test@example.com' });
    expect(user.research_consent).toBe(false); // Should convert 0 to false
  });

  test('updateUser updates allowed fields', async () => {
    db.run.mockResolvedValue({});
    db.get.mockResolvedValue({ 
      id: '1', 
      email: 'test@example.com', 
      first_name: 'Jane',
      last_name: 'Doe',
      research_consent: 1 
    });

    const user = await userService.updateUser('1', {
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '555-1234'
    });

    expect(db.run).toHaveBeenCalled();
    expect(user).toBeDefined();
  });

  test('updateUser converts researchConsent boolean to integer', async () => {
    db.run.mockResolvedValue({});
    db.get.mockResolvedValue({ id: '1', email: 'test@example.com', research_consent: 1 });

    await userService.updateUser('1', { researchConsent: true });

    // Check that research_consent was converted to 1
    const updateCall = db.run.mock.calls.find(call => 
      call[0].includes('research_consent')
    );
    expect(updateCall).toBeDefined();
  });

  test('deleteUser performs soft delete', async () => {
    db.get.mockResolvedValue({ id: '1', email: 'test@example.com' });
    db.run.mockResolvedValue({});

    const result = await userService.deleteUser('1', 'User requested deletion');

    expect(db.get).toHaveBeenCalled(); // Get user before delete
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('status = \'deleted\''),
      expect.arrayContaining(['1'])
    );
    expect(result).toBe(true);
  });

  test('deleteUser throws error if user not found', async () => {
    db.get.mockResolvedValue(null);

    await expect(userService.deleteUser('999', 'reason')).rejects.toThrow('User not found');
  });

  test('hardDeleteUser permanently deletes user', async () => {
    db.run.mockResolvedValue({});

    const result = await userService.hardDeleteUser('1');

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM users'),
      ['1']
    );
    expect(result).toBe(true);
  });

  test('changePassword hashes new password', async () => {
    db.run.mockResolvedValue({});

    await userService.changePassword('1', 'newPassword123');

    expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
    expect(db.run).toHaveBeenCalled();
  });

  test('getUsers returns filtered users', async () => {
    const mockUsers = [
      { id: '1', email: 'user1@example.com', role: 'patient', research_consent: 0 },
      { id: '2', email: 'user2@example.com', role: 'patient', research_consent: 1 }
    ];
    db.all.mockResolvedValue(mockUsers);

    const users = await userService.getUsers({ role: 'patient' });

    expect(db.all).toHaveBeenCalled();
    expect(users).toHaveLength(2);
    expect(users[0].research_consent).toBe(false);
    expect(users[1].research_consent).toBe(true);
  });

  test('getUsers excludes deleted users by default', async () => {
    db.all.mockResolvedValue([]);

    await userService.getUsers({ role: 'patient' });

    const sqlCall = db.all.mock.calls[0][0];
    expect(sqlCall).toContain("status != ?");
  });

  test('getUsers includes deleted when includeDeleted is true', async () => {
    db.all.mockResolvedValue([]);

    await userService.getUsers({ role: 'patient', includeDeleted: true });

    const sqlCall = db.all.mock.calls[0][0];
    expect(sqlCall).not.toContain("status != 'deleted'");
  });

  test('licenseNumberExists returns boolean', async () => {
    db.get.mockResolvedValue({ id: '1' });
    const exists = await userService.licenseNumberExists('LIC123');
    expect(exists).toBe(true);

    db.get.mockResolvedValue(null);
    const notExists = await userService.licenseNumberExists('LIC999');
    expect(notExists).toBe(false);
  });

  test('getHospitalSpecialistsByOrganization returns specialists', async () => {
    const mockSpecialists = [
      { id: '1', email: 'doc1@hospital.com', role: 'hospital', research_consent: 0 },
      { id: '2', email: 'doc2@hospital.com', role: 'hospital', research_consent: 1 }
    ];
    db.all.mockResolvedValue(mockSpecialists);

    const specialists = await userService.getHospitalSpecialistsByOrganization('General Hospital');

    expect(db.all).toHaveBeenCalled();
    expect(specialists).toHaveLength(2);
    expect(specialists[0].research_consent).toBe(false);
  });
});




