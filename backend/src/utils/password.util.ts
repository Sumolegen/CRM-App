import bcrypt from 'bcrypt';

export class PasswordUtil {
  private static readonly SALT_ROUNDS = 10;

  /**
   * Hashes a plaintext password using bcrypt.
   * @param password Plaintext password string
   */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compares a plaintext password against a stored bcrypt hash.
   * @param password Plaintext password
   * @param hash Stored password hash
   */
  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export const hashPassword = (password: string): Promise<string> =>
  PasswordUtil.hash(password);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
  PasswordUtil.compare(password, hash);
