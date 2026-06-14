export interface SecretStore {
  get(name: string): Promise<string>;
}
