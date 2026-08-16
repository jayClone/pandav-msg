import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import scrypt from 'scrypt-js';

/**
 * CryptoService - Handles E2EE encryption/decryption for private messages
 * Uses TweetNaCl box (Curve25519 + XSalsa20-Poly1305) for public-key authenticated encryption
 * This allows User A to encrypt with User B's public key, and User B to decrypt with their private key
 * Uses scrypt for deterministic keypair derivation from password
 */
class CryptoService {
  constructor() {
    // Store current user's keypair (derived from password at login)
    this.myKeypair = null;
    this.myUserId = null;

    // Store public keys of other users for encryption
    // Format: Map<userId, publicKey>
    this.publicKeys = new Map();

    // Version prefix for encrypted messages to support future upgrades
    this.VERSION_PREFIX = 'nacl_000001';
    this.SESSION_STORAGE_KEY = 'e2ee-keypair';

    // Trust-on-first-use key pinning: the server tells us a peer's public
    // key (there's no way to independently re-derive someone else's key
    // without their password), so the first key we see for a userId is
    // pinned in localStorage — persisted across logout so it survives to
    // the next session. If the server ever hands us a *different* key for
    // the same userId later, that's either the peer legitimately rotating
    // their key or a compromised/malicious server swapping in an
    // attacker's key to MITM the conversation. Either way we don't
    // silently trust it — see storePublicKey().
    this.PINNED_KEYS_STORAGE_KEY = 'e2ee-pinned-keys';
    this.KEY_CHANGED_EVENT = 'e2ee-key-changed';
  }

  canUseSessionStorage() {
    return typeof window !== 'undefined' && !!window.sessionStorage;
  }

  canUseLocalStorage() {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  loadPinnedKeys() {
    if (!this.canUseLocalStorage()) {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(this.PINNED_KEYS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  savePinnedKeys(pinned) {
    if (!this.canUseLocalStorage()) {
      return;
    }

    window.localStorage.setItem(this.PINNED_KEYS_STORAGE_KEY, JSON.stringify(pinned));
  }

  persistMyKeypair() {
    if (!this.canUseSessionStorage() || !this.myKeypair || !this.myUserId) {
      return;
    }

    const payload = {
      userId: this.myUserId,
      publicKey: encodeBase64(this.myKeypair.publicKey),
      secretKey: encodeBase64(this.myKeypair.secretKey),
    };

    window.sessionStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(payload));
  }

  restoreMyKeypairFromSession(expectedUserId = null) {
    if (!this.canUseSessionStorage()) {
      return false;
    }

    try {
      const raw = window.sessionStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!raw) {
        return false;
      }

      const stored = JSON.parse(raw);
      if (!stored?.userId || !stored?.publicKey || !stored?.secretKey) {
        return false;
      }

      if (expectedUserId && String(stored.userId) !== String(expectedUserId)) {
        this.clearPersistedKeypair();
        return false;
      }

      this.storeMyKeypair(
        stored.userId,
        decodeBase64(stored.publicKey),
        decodeBase64(stored.secretKey)
      );
      return true;
    } catch (error) {
      console.error('Failed to restore keypair from session:', error.message);
      this.clearPersistedKeypair();
      return false;
    }
  }

  clearPersistedKeypair() {
    if (!this.canUseSessionStorage()) {
      return;
    }

    window.sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
  }

  /**
   * Derive a deterministic keypair from email+password
   * Both the public and private keys can be recreated from the password
   * @param {string} email - User email (used as salt)
   * @param {string} password - User password
   * @returns {Promise<Object>} { publicKey: Uint8Array, secretKey: Uint8Array }
   */
  async deriveKeypairFromPassword(email, password) {
    try {
      if (!email || !password) {
        throw new Error('Email and password required for keypair derivation');
      }

      // Derive a 32-byte seed using scrypt
      const passwordBytes = new TextEncoder().encode(password);
      const saltBytes = new TextEncoder().encode(email);

      const seed = await scrypt.scrypt(
        passwordBytes,
        saltBytes,
        16384, // N: CPU/memory cost
        8,     // r: block size
        1,     // p: parallelization
        32     // output: 32 bytes for NaCl box keypair
      );

      // Create deterministic keypair from seed
      const keypair = nacl.box.keyPair.fromSecretKey(new Uint8Array(seed));

      return keypair;
    } catch (error) {
      console.error('Keypair derivation failed:', error.message);
      throw new Error(`Failed to derive keypair: ${error.message}`);
    }
  }

  /**
   * Store user's own keypair from login
   * @param {string} userId - Current user ID
   * @param {Uint8Array} publicKey - User's public key
   * @param {Uint8Array} secretKey - User's secret key
   */
  storeMyKeypair(userId, publicKey, secretKey) {
    this.myUserId = userId;
    this.myKeypair = { publicKey, secretKey };
    // ✅ Also store our own public key so we can decrypt our own messages (server echoes)
    this.publicKeys.set(userId, publicKey);
    this.persistMyKeypair();
  }

  /**
   * Store another user's public key for encryption to them.
   * Pins the key on first sight (TOFU) and refuses to silently swap in a
   * different key for a userId we've already pinned — see the
   * PINNED_KEYS_STORAGE_KEY comment in the constructor for why.
   * @param {string} userId - Other user's ID
   * @param {Uint8Array|string} publicKeyData - Their public key (base64 encoded string or Uint8Array)
   * @param {Object} [options]
   * @param {boolean} [options.trustChange=false] - Explicitly accept a key that differs from the pinned one (user-confirmed)
   * @returns {{changed: boolean, trusted: boolean}}
   */
  storePublicKey(userId, publicKeyData, { trustChange = false } = {}) {
    try {
      let publicKey = publicKeyData;

      // If it's a base64 string, decode it
      if (typeof publicKeyData === 'string') {
        publicKey = decodeBase64(publicKeyData);
      }

      const encoded = encodeBase64(publicKey);
      const pinned = this.loadPinnedKeys();
      const previouslyPinned = pinned[userId];
      const changed = !!previouslyPinned && previouslyPinned !== encoded;

      if (changed && !trustChange) {
        // Keep using the old (still-pinned) key rather than the new one —
        // any decrypt against the new key will fail loudly instead of
        // silently succeeding against a possibly-attacker-supplied key.
        // Let the UI decide how to surface this to the user.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(this.KEY_CHANGED_EVENT, {
            detail: { userId, oldPublicKey: previouslyPinned, newPublicKey: encoded },
          }));
        }
        return { changed: true, trusted: false };
      }

      this.publicKeys.set(userId, publicKey);
      pinned[userId] = encoded;
      this.savePinnedKeys(pinned);

      return { changed, trusted: true };
    } catch (error) {
      console.error('Failed to store public key:', error.message);
      throw error;
    }
  }

  /**
   * Explicitly accept a public key that differs from the previously pinned
   * one for this userId (i.e. the user was warned and chose to trust it).
   * @param {string} userId
   * @param {Uint8Array|string} publicKeyData
   */
  trustKeyChange(userId, publicKeyData) {
    return this.storePublicKey(userId, publicKeyData, { trustChange: true });
  }

  /**
   * Get another user's public key
   * @param {string} userId - User ID to get key for
   * @returns {Uint8Array|null} Public key or null if not found
   */
  getPublicKey(userId) {
    return this.publicKeys.get(userId) || null;
  }

  /**
   * Encrypt a message for a recipient using their public key
   * @param {string} plaintext - Message to encrypt
   * @param {string} recipientUserId - Recipient's user ID
   * @returns {Promise<string>} Encrypted message in format "nacl_000001:base64data"
   */
  async encryptMessage(plaintext, recipientUserId) {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext must be a non-empty string');
      }

      if (!this.myKeypair) {
        throw new Error('Encryption keypair not initialized. Please log in again.');
      }

      const recipientPublicKey = this.publicKeys.get(recipientUserId);
      if (!recipientPublicKey || !(recipientPublicKey instanceof Uint8Array)) {
        throw new Error(`Recipient public key not found for user: ${recipientUserId}`);
      }

      // Convert plaintext to bytes
      const messageBytes = new TextEncoder().encode(plaintext);

      // Generate random nonce (24 bytes for XSalsa20)
      const nonce = nacl.randomBytes(24);

      // Encrypt using public-key authenticated encryption (box)
      // This encrypts with recipient's public key, only recipient can decrypt with their private key
      const encrypted = nacl.box(
        messageBytes,
        nonce,
        recipientPublicKey,
        this.myKeypair.secretKey
      );

      if (!encrypted) {
        throw new Error('Encryption failed');
      }

      // Combine nonce + ciphertext and encode as base64
      const fullMessage = new Uint8Array(nonce.length + encrypted.length);
      fullMessage.set(nonce);
      fullMessage.set(encrypted, nonce.length);

      const encodedMessage = encodeBase64(fullMessage);

      // Return with version prefix
      return `${this.VERSION_PREFIX}:${encodedMessage}`;
    } catch (error) {
      console.error('Message encryption failed:', error.message);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt a message for every member of a group (pairwise fan-out).
   * Each member — including the sender themselves, so they can re-read
   * their own sent messages later — gets their own NaCl box ciphertext of
   * the same plaintext, produced with the exact same encryptMessage() used
   * for private messages. No new crypto primitive: a group message is just
   * N private-message encryptions of the same text.
   * @param {string} plaintext - Message to encrypt
   * @param {string[]} memberUserIds - Every current group member's userId, sender included
   * @returns {Promise<Object>} { [userId]: "nacl_000001:base64data" }
   */
  async encryptForGroup(plaintext, memberUserIds) {
    if (!Array.isArray(memberUserIds) || memberUserIds.length === 0) {
      throw new Error('memberUserIds must be a non-empty array');
    }

    const entries = await Promise.all(
      memberUserIds.map(async (memberId) => [memberId, await this.encryptMessage(plaintext, memberId)])
    );

    return Object.fromEntries(entries);
  }

  /**
   * Decrypt a message encrypted with our public key
   * @param {string} encryptedBlob - Encrypted message in format "nacl_000001:base64data"
   * @param {string} senderUserId - Sender's user ID (for getting their public key for verification)
   * @returns {Promise<string>} Decrypted plaintext message
   */
  async decryptMessage(encryptedBlob, senderUserId) {
    try {
      if (!encryptedBlob || typeof encryptedBlob !== 'string') {
        throw new Error('Encrypted blob must be a non-empty string');
      }

      if (!this.myKeypair) {
        throw new Error('Decryption keypair not initialized. Please log in again.');
      }

      const senderPublicKey = this.publicKeys.get(senderUserId);
      if (!senderPublicKey || !(senderPublicKey instanceof Uint8Array)) {
        throw new Error(`Sender public key not found for user: ${senderUserId}`);
      }

      // Parse version prefix and extract base64 data
      const [version, encodedData] = encryptedBlob.split(':');

      if (version !== this.VERSION_PREFIX) {
        throw new Error(`Unsupported encryption version: ${version}`);
      }

      if (!encodedData) {
        throw new Error('Invalid encrypted message format');
      }

      // Decode from base64
      const fullMessage = decodeBase64(encodedData);

      // Extract nonce (first 24 bytes) and ciphertext (rest)
      const nonce = fullMessage.slice(0, 24);
      const ciphertext = fullMessage.slice(24);

      // Decrypt using public-key authenticated encryption (box)
      // This decrypts with our secret key, using sender's public key for authentication
      const decrypted = nacl.box.open(
        ciphertext,
        nonce,
        senderPublicKey,
        this.myKeypair.secretKey
      );

      if (!decrypted) {
        throw new Error('Decryption failed - invalid key, corrupted message, or wrong sender');
      }

      // Convert decrypted bytes back to string
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Message decryption failed:', error.message);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Check if a message is encrypted (has version prefix)
   * @param {string} messageText - Message text to check
   * @returns {boolean} True if message is encrypted
   */
  isEncrypted(messageText) {
    return (
      messageText &&
      typeof messageText === 'string' &&
      messageText.startsWith(`${this.VERSION_PREFIX}:`)
    );
  }

  /**
   * Get encryption status for debugging
   * @returns {Object} Debug info about crypto state
   */
  getKeyStatus() {
    return {
      hasKeypair: !!this.myKeypair,
      myUserId: this.myUserId,
      publicKeysStored: this.publicKeys.size,
      publicKeyUserIds: Array.from(this.publicKeys.keys()),
      version: this.VERSION_PREFIX,
    };
  }

  /**
   * Clear all stored keys (call on logout)
   */
  clearAllKeys() {
    this.myKeypair = null;
    this.myUserId = null;
    this.publicKeys.clear();
    this.clearPersistedKeypair();
  }
}

// Export singleton instance
export default new CryptoService();
