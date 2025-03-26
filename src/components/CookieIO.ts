export class CookieIO {
  private readonly TAG = "EPSON_EPOSDEVICE_CLIENTID";
  private readonly EXPIRES_MINUTES = 5;

  /**
   * Writes a value to cookies associated with an address and the current document title.
   * @param value - The value to store.
   * @param address - The associated address.
   */
  public writeId(value: string, address: string): void {
    if (!address) return;

    const encodedAddress = encodeURIComponent(address);
    const encodedTitle = encodeURIComponent(document.title);
    const hostname = location.hostname;
    const expiration = this.getExpirationDate();
    const key = `${this.TAG}_${hostname}_${encodedAddress}_${encodedTitle}`;
    document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expiration} path=/`;
  }

  /**
   * Reads the stored ID from cookies for a specific address and title.
   * @param address - The associated address.
   * @returns The stored ID or an empty string if not found.
   */
  public readId(address: string): string {
    if (!address) return "";

    const encodedAddress = encodeURIComponent(address);
    const encodedTitle = encodeURIComponent(document.title);
    const hostname = location.hostname;
    const searchKey = `${this.TAG}_${hostname}_${encodedAddress}_${encodedTitle}=`;

    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
      if (cookie.startsWith(searchKey)) {
        return decodeURIComponent(cookie.split("=")[1]);
      }
    }
    return "";
  }

  /**
   * Calculates the cookie expiration date.
   * @returns A UTC string with the expiration date.
   */
  private getExpirationDate(): string {
    const expire = new Date();
    expire.setMinutes(expire.getMinutes() + this.EXPIRES_MINUTES);
    return expire.toUTCString();
  }
}
