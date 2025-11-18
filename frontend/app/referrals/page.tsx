'use client';

import { Suspense } from 'react';
import { ReferralDashboard } from '@/components/referral-dashboard';

function ReferralsPageContent() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <ReferralDashboard />
    </div>
  );
}

export default function ReferralsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReferralsPageContent />
    </Suspense>
  );
}
