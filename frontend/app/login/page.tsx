'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { auth } from '@/lib/auth';

type Tab = 'signin' | 'signup';

function LoginForm() {
  const [activeTab, setActiveTab] = useState<Tab>('signin');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle referral code from URL parameter
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      // Store in localStorage for later use
      localStorage.setItem('referral_code', refCode);
      // Pre-fill if on signup tab
      if (activeTab === 'signup') {
        setSignUpReferralCode(refCode);
      }
    } else {
      // Check localStorage for stored referral code
      const storedCode = localStorage.getItem('referral_code');
      if (storedCode && activeTab === 'signup') {
        setSignUpReferralCode((prev) => prev || storedCode);
      }
    }
  }, [searchParams, activeTab]);

  // Sign in form state
  const [signInUsername, setSignInUsername] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInMessage, setSignInMessage] = useState('');

  // Sign up form state
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpRecoveryEmail, setSignUpRecoveryEmail] = useState('');
  const [signUpFirstName, setSignUpFirstName] = useState('');
  const [signUpLastName, setSignUpLastName] = useState('');
  const [signUpDateOfBirth, setSignUpDateOfBirth] = useState('');
  const [signUpAgreedToTerms, setSignUpAgreedToTerms] = useState(false);
  const [signUpHeadline, setSignUpHeadline] = useState('');
  const [signUpBio, setSignUpBio] = useState('');
  const [signUpCompany, setSignUpCompany] = useState('');
  const [signUpProjectTitle, setSignUpProjectTitle] = useState('');
  const [signUpProjectDescription, setSignUpProjectDescription] = useState('');
  const [signUpZipCode, setSignUpZipCode] = useState('');
  const [signUpXProfileUsername, setSignUpXProfileUsername] = useState('');
  const [signUpYoutubeUsername, setSignUpYoutubeUsername] = useState('');
  const [signUpGithubUsername, setSignUpGithubUsername] = useState('');
  const [signUpLinkedinUsername, setSignUpLinkedinUsername] = useState('');
  const [signUpReferralCode, setSignUpReferralCode] = useState('');
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpMessage, setSignUpMessage] = useState('');
  const [signUpCurrentStep, setSignUpCurrentStep] = useState(1);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);
    setSignInMessage('');

    try {
      const result = await auth.loginWithPassword(signInUsername, signInPassword);

      if (result.twoFactorRequired) {
        // Redirect to 2FA page
        router.push('/auth/verify?twoFactor=true');
        return;
      }

      // Success - redirect to dashboard
      router.push('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign in';
      setSignInMessage(message);
    } finally {
      setSignInLoading(false);
    }
  };

  const calculateAge = (dateOfBirth: string): number | null => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  // Step validation functions
  const validateStep1 = (): string | null => {
    if (!signUpUsername.trim()) {
      return 'Username is required';
    }
    if (!signUpPassword) {
      return 'Password is required';
    }
    if (signUpPassword.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!signUpConfirmPassword) {
      return 'Please confirm your password';
    }
    if (signUpPassword !== signUpConfirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!signUpRecoveryEmail.trim()) {
      return 'Recovery email is required';
    }
    if (!signUpFirstName.trim()) {
      return 'First name is required';
    }
    if (!signUpLastName.trim()) {
      return 'Last name is required';
    }
    if (!signUpDateOfBirth) {
      return 'Date of birth is required';
    }
    const age = calculateAge(signUpDateOfBirth);
    if (age === null) {
      return 'Invalid date of birth';
    }
    if (age < 18) {
      return 'You must be at least 18 years old to use this service';
    }
    return null;
  };

  const handleNextStep = () => {
    let error: string | null = null;

    if (signUpCurrentStep === 1) {
      error = validateStep1();
      if (error) {
        setSignUpMessage(error);
        return;
      }
      setSignUpMessage('');
      setSignUpCurrentStep(2);
    } else if (signUpCurrentStep === 2) {
      error = validateStep2();
      if (error) {
        setSignUpMessage(error);
        return;
      }
      setSignUpMessage('');
      setSignUpCurrentStep(3);
    } else if (signUpCurrentStep === 3) {
      setSignUpCurrentStep(4);
    }
  };

  const handlePreviousStep = () => {
    if (signUpCurrentStep > 1) {
      setSignUpCurrentStep(signUpCurrentStep - 1);
      setSignUpMessage('');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpLoading(true);
    setSignUpMessage('');

    // Final validation before submission
    const step1Error = validateStep1();
    if (step1Error) {
      setSignUpMessage(step1Error);
      setSignUpCurrentStep(1);
      setSignUpLoading(false);
      return;
    }

    const step2Error = validateStep2();
    if (step2Error) {
      setSignUpMessage(step2Error);
      setSignUpCurrentStep(2);
      setSignUpLoading(false);
      return;
    }

    // Validate terms agreement
    if (!signUpAgreedToTerms) {
      setSignUpMessage('You must agree to the Terms of Service and Privacy Policy');
      setSignUpLoading(false);
      return;
    }

    try {
      // Use referral code from input or stored code
      const referralCode = signUpReferralCode || localStorage.getItem('referral_code') || undefined;

      // Construct full URLs from usernames
      const xProfileUrl = signUpXProfileUsername.trim()
        ? `https://x.com/${signUpXProfileUsername.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?x\.com\//, '')}`
        : undefined;
      const youtubeUrl = signUpYoutubeUsername.trim()
        ? `https://youtube.com/@${signUpYoutubeUsername.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?youtube\.com\/@?/, '')}`
        : undefined;
      const githubUrl = signUpGithubUsername.trim()
        ? `https://github.com/${signUpGithubUsername.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?github\.com\//, '')}`
        : undefined;
      const linkedinUrl = signUpLinkedinUsername.trim()
        ? `https://linkedin.com/in/${signUpLinkedinUsername.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}`
        : undefined;

      const result = await auth.signup({
        username: signUpUsername,
        password: signUpPassword,
        recovery_email: signUpRecoveryEmail,
        first_name: signUpFirstName,
        last_name: signUpLastName,
        date_of_birth: signUpDateOfBirth,
        headline: signUpHeadline || undefined,
        bio: signUpBio || undefined,
        company: signUpCompany || undefined,
        project_title: signUpProjectTitle || undefined,
        project_description: signUpProjectDescription || undefined,
        zip_code: signUpZipCode || undefined,
        x_profile_url: xProfileUrl,
        youtube_url: youtubeUrl,
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        referral_code: referralCode,
      });

      // Clear stored referral code after successful signup
      if (referralCode) {
        localStorage.removeItem('referral_code');
      }

      // Success - redirect to dashboard
      router.push('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create account';
      setSignUpMessage(message);
    } finally {
      setSignUpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 overflow-x-hidden px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">Welcome to Injest.io</CardTitle>
          <CardDescription className="text-center">
            Create your account or sign in to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tab buttons */}
          <div className="flex border-b mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setSignUpCurrentStep(1);
                setSignUpMessage('');
              }}
              className={`flex-1 py-2 px-4 text-center font-medium transition-colors ${
                activeTab === 'signin'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setSignUpCurrentStep(1);
                setSignUpMessage('');
              }}
              className={`flex-1 py-2 px-4 text-center font-medium transition-colors ${
                activeTab === 'signup'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-username">Username</Label>
                <Input
                  id="signin-username"
                  type="text"
                  placeholder="username"
                  value={signInUsername}
                  onChange={(e) => setSignInUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="Enter your password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <Button type="submit" className="w-full" disabled={signInLoading}>
                  {signInLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Forgot password?
                </button>
              </div>

              {signInMessage && (
                <p className={`text-sm text-center ${signInMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                  {signInMessage}
                </p>
              )}
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Step {signUpCurrentStep} of 4
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.round((signUpCurrentStep / 4) * 100)}% Complete
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(signUpCurrentStep / 4) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span className={signUpCurrentStep >= 1 ? 'text-blue-600 font-medium' : ''}>Credentials</span>
                  <span className={signUpCurrentStep >= 2 ? 'text-blue-600 font-medium' : ''}>Personal Info</span>
                  <span className={signUpCurrentStep >= 3 ? 'text-blue-600 font-medium' : ''}>Profile</span>
                  <span className={signUpCurrentStep >= 4 ? 'text-blue-600 font-medium' : ''}>Terms</span>
                </div>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Step 1: Credentials */}
                {signUpCurrentStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-username">Username *</Label>
                      <Input
                        id="signup-username"
                        type="text"
                        placeholder="johndoe"
                        value={signUpUsername}
                        onChange={(e) => setSignUpUsername(e.target.value)}
                        maxLength={30}
                        required
                      />
                      <p className="text-xs text-gray-500">
                        This will be your @injest.io email address (e.g., {signUpUsername || 'username'}@injest.io)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password *</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="At least 8 characters"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm-password">Confirm Password *</Label>
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="Confirm your password"
                        value={signUpConfirmPassword}
                        onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Personal Information */}
                {signUpCurrentStep === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-recovery-email">Recovery Email *</Label>
                      <Input
                        id="signup-recovery-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signUpRecoveryEmail}
                        onChange={(e) => setSignUpRecoveryEmail(e.target.value)}
                        required
                      />
                      <p className="text-xs text-gray-500">
                        Used for account recovery. Must be different from your @injest.io email.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-first-name">First Name *</Label>
                        <Input
                          id="signup-first-name"
                          type="text"
                          placeholder="John"
                          value={signUpFirstName}
                          onChange={(e) => setSignUpFirstName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-last-name">Last Name *</Label>
                        <Input
                          id="signup-last-name"
                          type="text"
                          placeholder="Doe"
                          value={signUpLastName}
                          onChange={(e) => setSignUpLastName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-date-of-birth">Date of Birth *</Label>
                      <Input
                        id="signup-date-of-birth"
                        type="date"
                        value={signUpDateOfBirth}
                        onChange={(e) => setSignUpDateOfBirth(e.target.value)}
                        required
                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      />
                      <p className="text-xs text-gray-500">
                        You must be at least 18 years old to use this service
                      </p>
                      {signUpDateOfBirth && calculateAge(signUpDateOfBirth) !== null && (
                        <p className={`text-xs ${calculateAge(signUpDateOfBirth)! < 18 ? 'text-red-600' : 'text-green-600'}`}>
                          Age: {calculateAge(signUpDateOfBirth)} years old
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Profile Section */}
                {signUpCurrentStep === 3 && (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <p className="text-sm font-medium text-gray-700">Optional Profile Information</p>

                    <div className="space-y-2">
                      <Label htmlFor="signup-headline">Headline</Label>
                      <Input
                        id="signup-headline"
                        type="text"
                        placeholder="e.g., Software Engineer at Company"
                        value={signUpHeadline}
                        onChange={(e) => setSignUpHeadline(e.target.value)}
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-bio">Bio</Label>
                      <Textarea
                        id="signup-bio"
                        placeholder="Tell us about yourself..."
                        value={signUpBio}
                        onChange={(e) => setSignUpBio(e.target.value)}
                        rows={3}
                        maxLength={250}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-company">Company</Label>
                      <Input
                        id="signup-company"
                        type="text"
                        placeholder="e.g., Acme Inc."
                        value={signUpCompany}
                        onChange={(e) => setSignUpCompany(e.target.value)}
                        maxLength={200}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-project-title">Project Title</Label>
                      <Input
                        id="signup-project-title"
                        type="text"
                        placeholder="e.g., Building a new mobile app"
                        value={signUpProjectTitle}
                        onChange={(e) => setSignUpProjectTitle(e.target.value)}
                        maxLength={200}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-project-description">Project Description</Label>
                      <Textarea
                        id="signup-project-description"
                        placeholder="Tell us about your project..."
                        value={signUpProjectDescription}
                        onChange={(e) => setSignUpProjectDescription(e.target.value)}
                        rows={3}
                        maxLength={500}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-zip-code">Zip Code</Label>
                      <Input
                        id="signup-zip-code"
                        type="text"
                        placeholder="12345"
                        value={signUpZipCode}
                        onChange={(e) => setSignUpZipCode(e.target.value)}
                        maxLength={20}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-x-profile">X (Twitter) Profile</Label>
                      <Input
                        id="signup-x-profile"
                        type="text"
                        placeholder="username"
                        value={signUpXProfileUsername}
                        onChange={(e) => setSignUpXProfileUsername(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-youtube">YouTube Channel</Label>
                      <Input
                        id="signup-youtube"
                        type="text"
                        placeholder="username"
                        value={signUpYoutubeUsername}
                        onChange={(e) => setSignUpYoutubeUsername(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-github">GitHub Profile</Label>
                      <Input
                        id="signup-github"
                        type="text"
                        placeholder="username"
                        value={signUpGithubUsername}
                        onChange={(e) => setSignUpGithubUsername(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-linkedin">LinkedIn Profile</Label>
                      <Input
                        id="signup-linkedin"
                        type="text"
                        placeholder="username"
                        value={signUpLinkedinUsername}
                        onChange={(e) => setSignUpLinkedinUsername(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Referral & Terms */}
                {signUpCurrentStep === 4 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-referral-code">Referral Code (Optional)</Label>
                      <Input
                        id="signup-referral-code"
                        type="text"
                        placeholder="Enter referral code"
                        value={signUpReferralCode}
                        onChange={(e) => setSignUpReferralCode(e.target.value)}
                        maxLength={20}
                      />
                      <p className="text-xs text-gray-500">
                        Have a referral code? Enter it here to support the person who referred you.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="signup-agree-terms"
                          checked={signUpAgreedToTerms}
                          onCheckedChange={(checked) => setSignUpAgreedToTerms(checked === true)}
                          required
                        />
                        <Label htmlFor="signup-agree-terms" className="text-sm font-normal cursor-pointer">
                          I agree to the{' '}
                          <Link href="/terms" className="text-blue-600 hover:underline" target="_blank">
                            Terms of Service
                          </Link>
                          {' '}and{' '}
                          <Link href="/privacy" className="text-blue-600 hover:underline" target="_blank">
                            Privacy Policy
                          </Link>
                          {' '}*
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-4">
                  {signUpCurrentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePreviousStep}
                      className="flex-1"
                    >
                      Back
                    </Button>
                  )}
                  {signUpCurrentStep < 4 ? (
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      className="flex-1"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={
                        signUpLoading ||
                        !signUpAgreedToTerms ||
                        !!(signUpDateOfBirth && calculateAge(signUpDateOfBirth) !== null && calculateAge(signUpDateOfBirth)! < 18)
                      }
                    >
                      {signUpLoading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  )}
                </div>

                {signUpMessage && (
                  <p className={`text-sm text-center ${signUpMessage.includes('Failed') || signUpMessage.includes('not match') || signUpMessage.includes('required') || signUpMessage.includes('must be') || signUpMessage.includes('Invalid') ? 'text-red-600' : 'text-green-600'}`}>
                    {signUpMessage}
                  </p>
                )}
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
