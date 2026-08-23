import { beforeEach, describe, expect, it } from 'vitest';
import cryptoService from '../crypto.service';

describe('CryptoService', () => {
  beforeEach(() => {
    cryptoService.clearAllKeys();
    window.sessionStorage.clear();
    window.localStorage.clear();
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

  describe('public key pinning (TOFU + change detection)', () => {
    it('pins a public key on first sight and trusts it', async () => {
      const bob = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-pass');

      const result = cryptoService.storePublicKey('bob-id', bob.publicKey);

      expect(result).toEqual({ changed: false, trusted: true });
      expect(cryptoService.getPublicKey('bob-id')).toEqual(bob.publicKey);
    });

    it('accepts the same key again as a no-op', async () => {
      const bob = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-pass');

      cryptoService.storePublicKey('bob-id', bob.publicKey);
      const result = cryptoService.storePublicKey('bob-id', bob.publicKey);

      expect(result).toEqual({ changed: false, trusted: true });
    });

    it('refuses a different key for an already-pinned userId and emits a warning event', async () => {
      const bob = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-pass');
      const attacker = await cryptoService.deriveKeypairFromPassword('attacker@example.com', 'attacker-pass');

      cryptoService.storePublicKey('bob-id', bob.publicKey);

      let eventDetail = null;
      const handler = (e) => { eventDetail = e.detail; };
      window.addEventListener(cryptoService.KEY_CHANGED_EVENT, handler);

      const result = cryptoService.storePublicKey('bob-id', attacker.publicKey);

      window.removeEventListener(cryptoService.KEY_CHANGED_EVENT, handler);

      expect(result).toEqual({ changed: true, trusted: false });
      // still trusts the OLD key, not the new one
      expect(cryptoService.getPublicKey('bob-id')).toEqual(bob.publicKey);
      expect(eventDetail).toMatchObject({ userId: 'bob-id' });
    });

    it('accepts a changed key once explicitly trusted via trustKeyChange', async () => {
      const bob = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-pass');
      const bobNew = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-new-pass');

      cryptoService.storePublicKey('bob-id', bob.publicKey);
      cryptoService.storePublicKey('bob-id', bobNew.publicKey); // rejected, stays pinned to old key

      const result = cryptoService.trustKeyChange('bob-id', bobNew.publicKey);

      expect(result).toEqual({ changed: true, trusted: true });
      expect(cryptoService.getPublicKey('bob-id')).toEqual(bobNew.publicKey);
    });
  });

  describe('image messages', () => {
    // A tiny fake "image" — the actual bytes don't matter for these tests,
    // only that they round-trip correctly.
    const fakeImageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5]);

    it('encrypts and decrypts an image for a single private-chat recipient', async () => {
      const alice = await cryptoService.deriveKeypairFromPassword('alice@example.com', 'alice-pass');
      const bob = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-pass');

      cryptoService.storeMyKeypair('alice-id', alice.publicKey, alice.secretKey);
      cryptoService.storePublicKey('bob-id', bob.publicKey);

      const result = await cryptoService.encryptImageForRecipient(fakeImageBytes, 'image/png', 'bob-id');

      expect(result.imageMimeType).toBe('image/png');
      expect(cryptoService.isEncrypted(result.wrappedKey)).toBe(true);

      cryptoService.clearAllKeys();
      cryptoService.storeMyKeypair('bob-id', bob.publicKey, bob.secretKey);
      cryptoService.storePublicKey('alice-id', alice.publicKey);

      const decrypted = await cryptoService.decryptImage(
        result.wrappedKey,
        result.imageCiphertext,
        result.imageNonce,
        'alice-id'
      );

      expect(Array.from(decrypted)).toEqual(Array.from(fakeImageBytes));
    });

    it('fans out only the small content key for a group image, not the image itself', async () => {
      const alice = await cryptoService.deriveKeypairFromPassword('alice@example.com', 'alice-pass');
      const bob = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-pass');
      const carol = await cryptoService.deriveKeypairFromPassword('carol@example.com', 'carol-pass');

      cryptoService.storeMyKeypair('alice-id', alice.publicKey, alice.secretKey);
      cryptoService.storePublicKey('bob-id', bob.publicKey);
      cryptoService.storePublicKey('carol-id', carol.publicKey);

      const result = await cryptoService.encryptImageForGroup(
        fakeImageBytes,
        'image/jpeg',
        ['alice-id', 'bob-id', 'carol-id']
      );

      expect(Object.keys(result.wrappedKeys).sort()).toEqual(['alice-id', 'bob-id', 'carol-id']);
      // each member's wrapped key is a small, distinct ciphertext — nowhere
      // near the size of a real (or even this fake) image blob duplicated
      // per member.
      expect(result.wrappedKeys['alice-id']).not.toBe(result.wrappedKeys['bob-id']);
      Object.values(result.wrappedKeys).forEach((wrappedKey) => {
        expect(wrappedKey.length).toBeLessThan(200);
      });

      // Bob decrypts using his own wrapped-key entry.
      cryptoService.clearAllKeys();
      cryptoService.storeMyKeypair('bob-id', bob.publicKey, bob.secretKey);
      cryptoService.storePublicKey('alice-id', alice.publicKey);

      const decrypted = await cryptoService.decryptImage(
        result.wrappedKeys['bob-id'],
        result.imageCiphertext,
        result.imageNonce,
        'alice-id'
      );

      expect(Array.from(decrypted)).toEqual(Array.from(fakeImageBytes));
    });

    it('fails to decrypt with the wrong sender key', async () => {
      const alice = await cryptoService.deriveKeypairFromPassword('alice@example.com', 'alice-pass');
      const mallory = await cryptoService.deriveKeypairFromPassword('mallory@example.com', 'mallory-pass');
      const bob = await cryptoService.deriveKeypairFromPassword('bob@example.com', 'bob-pass');

      cryptoService.storeMyKeypair('alice-id', alice.publicKey, alice.secretKey);
      cryptoService.storePublicKey('bob-id', bob.publicKey);

      const result = await cryptoService.encryptImageForRecipient(fakeImageBytes, 'image/png', 'bob-id');

      cryptoService.clearAllKeys();
      cryptoService.storeMyKeypair('bob-id', bob.publicKey, bob.secretKey);
      cryptoService.storePublicKey('mallory-id', mallory.publicKey); // wrong sender key on file

      await expect(
        cryptoService.decryptImage(result.wrappedKey, result.imageCiphertext, result.imageNonce, 'mallory-id')
      ).rejects.toThrow();
    });

    it('imageBytesToDataUrl produces a usable data: URL', () => {
      const url = cryptoService.imageBytesToDataUrl(fakeImageBytes, 'image/png');
      expect(url.startsWith('data:image/png;base64,')).toBe(true);
    });
  });
});
