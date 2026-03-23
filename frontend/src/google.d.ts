interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: Record<string, string | number | boolean>,
  ): void;
}

interface GoogleIdentityApi {
  accounts: {
    id: GoogleAccountsId;
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

export {};
