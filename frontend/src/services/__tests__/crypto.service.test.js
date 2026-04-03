import { beforeEach, describe, expect, it } from 'vitest';
import cryptoService from '../crypto.service';

describe('CryptoService', () => {
  beforeEach(() => {
    cryptoService.clearAllKeys();
    window.sessionStorage.clear();
  });

  it('derives a deterministic keypair from email and password', async () => {
    const email = 'test@example.com';
    const password = 'testPassword123';

    const keypair1 = await cryptoService.deriveKeypairFromPassword(email, password);
    const keypair2 = await cryptoService.deriveKeypairFromPassword(email, password);

    expect(Array.from(keypair1.publicKey)).toEqual(Array.from(keypair2.publicKey));
    expect(Array.from(keypair1.secretKey)).toEqual(Array.from(keypair2.secretKey));
    expect(keypair1.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair1.secretKey).toBeInstanceOf(Uint8Array);
  });

  it('encrypts for a recipient and decrypts with the recipient keypair', async () => {
    const alice = await cryptoService.deriveKeypairFromPassword('alice@example.com', 'alice-pass');
    const bob = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-pass');

    cryptoService.storeMyKeypair('alice-id', alice.publicKey, alice.secretKey);
    cryptoService.storePublicKey('bob-id', bob.publicKey);

    const encrypted = await cryptoService.encryptMessage('hello bob', 'bob-id');
    expect(cryptoService.isEncrypted(encrypted)).toBe(true);

    cryptoService.clearAllKeys();
    cryptoService.storeMyKeypair('bob-id', bob.publicKey, bob.secretKey);
    cryptoService.storePublicKey('alice-id', alice.publicKey);

    await expect(cryptoService.decryptMessage(encrypted, 'alice-id')).resolves.toBe('hello bob');
  });

  it('restores the current user keypair from session storage', async () => {
    const keypair = await cryptoService.deriveKeypairFromPassword('user@example.com', 'secret-pass');

    cryptoService.storeMyKeypair('user-1', keypair.publicKey, keypair.secretKey);

    cryptoService.myKeypair = null;
    cryptoService.myUserId = null;
    cryptoService.publicKeys.clear();

    const restored = cryptoService.restoreMyKeypairFromSession('user-1');

    expect(restored).toBe(true);
    expect(cryptoService.getKeyStatus().hasKeypair).toBe(true);
    expect(cryptoService.getPublicKey('user-1')).toBeInstanceOf(Uint8Array);
  });

  it('clears session-stored key material on logout', async () => {
    const keypair = await cryptoService.deriveKeypairFromPassword('user@example.com', 'secret-pass');

    cryptoService.storeMyKeypair('user-1', keypair.publicKey, keypair.secretKey);
    expect(window.sessionStorage.getItem('e2ee-keypair')).toBeTruthy();

    cryptoService.clearAllKeys();

    expect(window.sessionStorage.getItem('e2ee-keypair')).toBeNull();
    expect(cryptoService.getKeyStatus().hasKeypair).toBe(false);
  });
});
