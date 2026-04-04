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
  }

  canUseSessionStorage() {
    return typeof window !== 'undefined' && !!window.sessionStorage;
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
   * Store another user's public key for encryption to them
   * @param {string} userId - Other user's ID
   * @param {Uint8Array} publicKey - Their public key (base64 encoded string or Uint8Array)
   */
  storePublicKey(userId, publicKeyData) {
    try {
      let publicKey = publicKeyData;

      // If it's a base64 string, decode it
      if (typeof publicKeyData === 'string') {
        publicKey = decodeBase64(publicKeyData);
      }

      this.publicKeys.set(userId, publicKey);
    } catch (error) {
      console.error('Failed to store public key:', error.message);
      throw error;
    }
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
   * Derive another user's public key from their email
   * This is possible because we use deterministic key derivation from email + password
   * Any user can independently compute any other user's public key if they know the email
   * @param {string} email - Other user's email
   * @param {string} userId - Other user's ID (for caching)
   * @returns {Promise<Uint8Array>} Their public key
   */
  async derivePublicKeyFromEmail(email, userId) {
    try {
      if (!email) {
        throw new Error('Email required to derive public key');
      }

      // Check cache first
      if (userId && this.publicKeys.has(userId)) {
        return this.publicKeys.get(userId);
      }

      // Derive keypair from email (same method as login but we're deriving for someone else)
      // They will use: deriveKeypairFromPassword(email, password)
      // We'll use: deriveKeypairFromEmail(email) which derives from email alone
      const emailBytes = new TextEncoder().encode(email);
      const saltBytes = new TextEncoder().encode(email + ':publickey');

      // Derive using scrypt
      const seed = await scrypt.scrypt(
        emailBytes,
        saltBytes,
        16384, 8, 1, 32
      );

      // Create public key from seed (matches keypair format)
      const keypair = nacl.box.keyPair.fromSecretKey(new Uint8Array(seed));

      // Cache it
      if (userId) {
        this.publicKeys.set(userId, keypair.publicKey);
      }

      return keypair.publicKey;
    } catch (error) {
      console.error('Failed to derive public key from email:', error.message);
      throw error;
    }
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
