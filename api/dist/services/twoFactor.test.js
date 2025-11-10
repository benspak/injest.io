import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { authenticator } from 'otplib';
import { generateTwoFactorSecret, verifyTwoFactorToken, generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode, generateRecoveryCode, } from './twoFactor.js';
describe('twoFactor service', () => {
    test('generateTwoFactorSecret returns a secret and otpauth url containing the email', () => {
        const email = 'user@example.com';
        const { secret, otpauthUrl } = generateTwoFactorSecret(email);
        assert.ok(secret.length > 0, 'secret should not be empty');
        const encodedEmail = encodeURIComponent(email);
        assert.ok(otpauthUrl.includes(encodedEmail) || decodeURIComponent(otpauthUrl).includes(email), 'otpauthUrl should embed the email');
        assert.ok(otpauthUrl.startsWith('otpauth://totp/'), 'otpauthUrl should be a valid otpauth URI');
    });
    test('verifyTwoFactorToken validates authenticator codes generated from the same secret', () => {
        const email = 'user@example.com';
        const { secret } = generateTwoFactorSecret(email);
        const token = authenticator.generate(secret);
        assert.equal(verifyTwoFactorToken(secret, token), true, 'valid token should pass verification');
        assert.equal(verifyTwoFactorToken(secret, '000000'), false, 'incorrect token should fail verification');
    });
    test('generateRecoveryCodes returns unique uppercase codes', () => {
        const codes = generateRecoveryCodes();
        assert.equal(codes.length, 10, 'should generate ten codes by default');
        const uniqueCodes = new Set(codes);
        assert.equal(uniqueCodes.size, codes.length, 'recovery codes should be unique');
        codes.forEach((code) => {
            assert.match(code, /^[A-Z0-9-]+$/, 'recovery codes should be uppercase and hyphenated');
        });
    });
    test('hashRecoveryCode normalizes codes before hashing', () => {
        const code = generateRecoveryCode();
        const hashA = hashRecoveryCode(code);
        const hashB = hashRecoveryCode(code.toLowerCase().replace('-', ' '));
        assert.equal(hashA, hashB, 'hash should be invariant to formatting differences');
    });
    test('verifyRecoveryCode validates and consumes matching codes', () => {
        const codes = generateRecoveryCodes(2);
        const hashedCodes = codes.map(hashRecoveryCode);
        const firstResult = verifyRecoveryCode(hashedCodes, codes[0]);
        assert.equal(firstResult.valid, true, 'matching code should be valid');
        assert.equal(firstResult.remaining?.length, 1, 'matching code should be removed from remaining list');
        const secondResult = verifyRecoveryCode(firstResult.remaining, codes[1]);
        assert.equal(secondResult.valid, true, 'second code should also be valid');
        assert.equal(secondResult.remaining?.length, 0, 'all codes should be consumed');
        const invalidResult = verifyRecoveryCode(secondResult.remaining, codes[1]);
        assert.equal(invalidResult.valid, false, 'used code should no longer be valid');
    });
});
//# sourceMappingURL=twoFactor.test.js.map