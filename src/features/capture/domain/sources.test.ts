import { activeCapturePackages } from './sources';

describe('activeCapturePackages', () => {
  it('allows notifications only for active supported bank accounts', () => {
    const packages = activeCapturePackages([
      { name: 'ING', type: 'bank', archived: false },
      { name: 'Revolut', type: 'bank', archived: true },
      { name: 'Cash', type: 'cash', archived: false },
    ]);

    expect(packages).toContain('ro.ing.mobile.banking.android.activity');
    expect(packages).not.toContain('com.revolut.revolut');
  });
});
