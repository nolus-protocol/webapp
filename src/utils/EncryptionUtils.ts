import CryptoJS from "crypto-js";
import { Buffer } from "buffer";

export class EncryptionUtils {
  
  public static encryptEncryptionKey(
    encryptionKey: string,
    password: string
  ): string {
    const passwordHash = Buffer.from(
      CryptoJS.SHA512(password).toString(),
      "hex"
    );
    const key = passwordHash.slice(0, 32);
    const iv = passwordHash.slice(32, 48);
    const encryptedData = CryptoJS.AES.encrypt(encryptionKey, key.toString(), {
      iv: CryptoJS.enc.Utf8.parse(iv.toString()),
    });
    return encryptedData.toString();
  }

  public static decryptEncryptionKey(
    encryptKey: string,
    password: string
  ): string {
    const passwordHash = Buffer.from(
      CryptoJS.SHA512(password).toString(),
      "hex"
    );
    const key = passwordHash.slice(0, 32);
    const iv = passwordHash.slice(32, 48);
    const decryptData = CryptoJS.AES.decrypt(encryptKey, key.toString(), {
      iv: CryptoJS.enc.Utf8.parse(iv.toString()),
    });
    return decryptData.toString(CryptoJS.enc.Utf8);
  }

  public static encryptPrivateKey(
    privateKey: string,
    pubKey: string,
    password: string
  ) {
    const passwordHash = CryptoJS.SHA512(password).toString();
    const doubleHash = Buffer.from(
      CryptoJS.SHA512(CryptoJS.SHA512(pubKey).toString()).toString(),
      "hex"
    );

    const iv = doubleHash.slice(0, 16);
    const encryptedData = CryptoJS.AES.encrypt(privateKey, passwordHash, {
      iv: CryptoJS.enc.Utf8.parse(iv.toString()),
    });
    return encryptedData.toString();
  }

  public static decryptPrivateKey(
    encPrivateKey: string,
    pubKey: string,
    password: string
  ) {
    const passwordHash = CryptoJS.SHA512(password).toString();
    const doubleHash = Buffer.from(
      CryptoJS.SHA512(CryptoJS.SHA512(pubKey).toString()).toString(),
      "hex"
    );
    const iv = doubleHash.slice(0, 16);
    const decryptedData = CryptoJS.AES.decrypt(encPrivateKey, passwordHash, {
      iv: CryptoJS.enc.Utf8.parse(iv.toString()),
    });
    return decryptedData.toString(CryptoJS.enc.Utf8);
  }
}
