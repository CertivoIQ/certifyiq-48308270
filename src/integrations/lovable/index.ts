type SignInOptions = { redirect_uri?: string }

const disabled = async (_provider: string, _opts?: SignInOptions): Promise<never> => {
  throw new Error('Lovable authentication is disabled by CertivoIQ operating policy.')
}

/** Compatibility export that cannot contact Lovable. */
export const lovable = {
  auth: {
    signInWithOAuth: disabled,
  },
}
