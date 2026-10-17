export type GoogleIdentity = {
  initialize(options: { client_id: string; nonce: string; callback: (result: { credential?: string }) => void; auto_select: boolean; use_fedcm_for_prompt: boolean; prompt_parent_id: string }): void;
  renderButton(parent: HTMLElement, options: { type: string; theme: string; size: string; text: string; shape: string; width: number; locale: string }): void;
  prompt(): void;
  cancel(): void;
};

declare global { interface Window { google?: { accounts?: { id?: GoogleIdentity } } } }
let pending: Promise<GoogleIdentity> | null = null;
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const existing = window.google?.accounts?.id;
  if (existing) return Promise.resolve(existing);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      const timer = window.setTimeout(() => { script.remove(); reject(new Error('O Google demorou a responder. Tente novamente ou continue em outra página.')); }, 12000);
      script.onload = () => {
        clearTimeout(timer);
        const sdk = window.google?.accounts?.id;
        if (sdk) resolve(sdk);
        else { script.remove(); reject(new Error('Não foi possível carregar a entrada do Google.')); }
      };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Seu navegador não conseguiu carregar o Google. Continue em outra página.')); };
      document.head.append(script);
    });
  }
  return pending.catch(error => { pending = null; throw error; });
}
