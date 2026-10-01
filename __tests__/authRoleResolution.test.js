const { mapRoleForBackend } = require('../src/screens/auth/googleAuthRole');
const {
  resolveAuthRole,
  routeForAuthRole,
} = require('../src/screens/auth/resolveAuthRole');

describe('Google auth role mapping', () => {
  it('keeps doctor as a real backend role', () => {
    expect(mapRoleForBackend('doctor')).toBe('doctor');
  });

  it('maps counselor spelling to the backend counsellor role', () => {
    expect(mapRoleForBackend('counselor')).toBe('counsellor');
    expect(mapRoleForBackend('counsellor')).toBe('counsellor');
  });
});

describe('auth role resolution', () => {
  it('honors explicit doctor accountRole even when backend role is counsellor', () => {
    const role = resolveAuthRole(
      {
        role: 'counsellor',
        accountRole: 'doctor',
        user: { role: 'counsellor' },
      },
      'counselor',
    );

    expect(role).toBe('doctor');
    expect(routeForAuthRole(role)).toBe('DoctorDashboard');
  });

  it('detects doctor from psychiatrist specialization on legacy counsellor data', () => {
    expect(
      resolveAuthRole({
        user: {
          role: 'counsellor',
          specialization: 'Child Psychiatrist',
        },
      }),
    ).toBe('doctor');
  });
});
